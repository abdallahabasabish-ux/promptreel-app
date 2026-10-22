import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { GeminiError, deleteGeminiFile, generateScenes, getActiveKeys, pickModel, pollGeminiFile, uploadVideoToGemini } from "@/lib/gemini";
import { readUpload, removeUpload } from "@/lib/video";
import type { GeneratedScenes } from "@/lib/gemini";

async function setStatus(id: string, status: string, progress: number, message: string) {
  await db.project.update({ where: { id }, data: { status, progress, statusMessage: message } }).catch(() => {});
}

function clampSceneCount(n: unknown, expected: number): number {
  const c = typeof n === "number" && n > 0 ? Math.round(n) : expected;
  return Math.min(12, Math.max(3, c));
}

function normalizeScenes(raw: GeneratedScenes, expected: number, languageCode: string) {
  const list = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (list.length === 0) throw new GeminiError("Gemini returned no scenes.");
  // Trim or extend: keep first `expected` scenes (generation is instructed to produce exactly expected)
  const picked = list.slice(0, Math.max(expected, 1));
  return picked.map((s, i) => ({
    idx: i + 1,
    title: String(s.title || `Scene ${i + 1}`).slice(0, 120),
    durationSec: Math.min(12, Math.max(4, Math.round(Number(s.duration_seconds) || 8))),
    imagePrompt: String(s.image_prompt || "").trim(),
    videoPrompt: String(s.video_prompt || "").trim(),
    dialogue: String(s.dialogue || "").trim() || null,
    camera: String(s.camera || "").trim() || null,
    transition: String(s.transition || "").trim() || null,
    languageCode,
  }));
}

/**
 * Full generation pipeline. Runs detached (fire-and-forget) from the API route.
 * State machine: queued -> running (uploading/analyzing/writing/saving) -> succeeded | failed
 */
export async function runGeneration(projectId: string): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { video: true } });
  if (!project || project.status === "succeeded") return;

  const settings = await getSettings();
  const keys = await getActiveKeys();
  if (keys.length === 0) {
    await db.project.update({
      where: { id: projectId },
      data: { status: "failed", error: "No Gemini API key is configured. Ask the administrator to add one in the admin panel.", progress: 100 },
    });
    return;
  }

  const model = pickModel(!!project.video, project.sceneCount, settings);
  await db.project.update({ where: { id: projectId }, data: { status: "running", modelUsed: model, progress: 8, statusMessage: "Preparing your prompt package…" } });

  let geminiFileName: string | null = null;
  let videoBuffer: Buffer | null = null;

  try {
    // 1. Upload reference video (if any)
    if (project.video) {
      await setStatus(projectId, "running", 20, "Uploading your reference video to Gemini…");
      videoBuffer = await readUpload(project.video.storedPath);
      if (!videoBuffer) throw new GeminiError("The reference video file is no longer available. Please try again without it.");
      const sniffMime = project.video.mimeType;
      let uploaded = false;
      let lastErr: unknown = null;
      for (const k of keys) {
        try {
          const up = await uploadVideoToGemini(videoBuffer, sniffMime, `chafiktech-${projectId}`, k.key);
          geminiFileName = up.name;
          await db.referenceVideo.update({ where: { id: project.video.id }, data: { geminiFileUri: up.uri, geminiFileName: up.name, geminiState: "UPLOADED" } });
          uploaded = true;
          break;
        } catch (e) {
          lastErr = e;
          if (e instanceof GeminiError && !e.transient) continue; // try next key
          continue;
        }
      }
      if (!uploaded) throw lastErr ?? new GeminiError("Video upload failed.", true);

      await setStatus(projectId, "running", 40, "Gemini is processing the video…");
      for (const k of keys) {
        try {
          await pollGeminiFile(geminiFileName!, k.key);
          break;
        } catch (e) {
          if (e instanceof GeminiError && !e.transient) throw e;
        }
      }
    }

    // 2. Generate scene prompts
    await setStatus(projectId, "running", 60, "Writing your professional scene prompts…");
    let generated: GeneratedScenes | null = null;
    let genErr: unknown = null;
    for (const k of keys) {
      try {
        generated = await generateScenes({
          idea: project.idea,
          sceneCount: project.sceneCount,
          languageName: project.languageName,
          nativeName: project.languageName,
          hasVideo: !!project.video,
          videoUri: project.video?.geminiFileUri ?? undefined,
          videoMime: project.video?.mimeType ?? undefined,
          model,
          apiKey: k.key,
        });
        genErr = null;
        break;
      } catch (e) {
        genErr = e;
        if (e instanceof GeminiError && e.transient) continue;
        // Permanent error (bad key / blocked): try next key for key errors, otherwise stop
        const msg = e instanceof Error ? e.message : "";
        if (/API key|permission|PERMISSION|unauthenticated|UNAUTH/i.test(msg)) continue;
        throw e;
      }
    }
    if (!generated) throw genErr ?? new GeminiError("Generation failed.", true);

    // 3. Validate + save scenes
    await setStatus(projectId, "running", 85, "Validating and saving your scenes…");
    const scenes = normalizeScenes(generated, project.sceneCount, project.languageCode);
    await db.scene.deleteMany({ where: { projectId } });
    await db.scene.createMany({ data: scenes.map((s) => ({ ...s, projectId })) });
    await db.project.update({
      where: { id: projectId },
      data: {
        status: "succeeded",
        progress: 100,
        statusMessage: "Done",
        title: (generated.title || project.title).slice(0, 120),
        completedAt: new Date(),
        error: null,
      },
    });

    // 4. Cleanup
    if (geminiFileName) {
      const k = keys[0];
      await deleteGeminiFile(geminiFileName, k.key).catch(() => {});
    }
    if (project.video) {
      await db.referenceVideo.update({ where: { id: project.video.id }, data: { geminiState: "DELETED", cleanedAt: new Date() } });
      await removeUpload(project.video.storedPath).catch(() => {});
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed unexpectedly.";
    await db.project.update({
      where: { id: projectId },
      data: { status: "failed", progress: 100, error: message.slice(0, 500), statusMessage: "Failed" },
    });
    if (geminiFileName && videoBuffer) {
      await deleteGeminiFile(geminiFileName, keys[0].key).catch(() => {});
    }
  }
}
