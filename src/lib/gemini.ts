import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

const BASE = "https://generativelanguage.googleapis.com";

export type GeminiKeyInfo = { id: string; label: string; key: string };

/** Active keys from admin panel, falling back to the env key. */
export async function getActiveKeys(): Promise<GeminiKeyInfo[]> {
  const rows = await db.geminiKey.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const keys: GeminiKeyInfo[] = rows.map((r) => ({ id: r.id, label: r.label, key: r.key }));
  if (process.env.GEMINI_API_KEY) {
    keys.push({ id: "env", label: "Environment key", key: process.env.GEMINI_API_KEY });
  }
  return keys;
}

export function pickModel(hasVideo: boolean, sceneCount: number, settings: { geminiAutoModel: boolean; geminiModelFlash: string; geminiModelPro: string }): string {
  if (settings.geminiAutoModel && (hasVideo || sceneCount >= 6)) return settings.geminiModelPro;
  return settings.geminiModelFlash;
}

export class GeminiError extends Error {
  transient: boolean;
  constructor(message: string, transient = false) {
    super(message);
    this.transient = transient;
  }
}

/** Resumable upload to the Gemini Files API. Returns file metadata. */
export async function uploadVideoToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string,
  apiKey: string
): Promise<{ uri: string; name: string }> {
  const startRes = await fetch(`${BASE}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buffer.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!startRes.ok) throw new GeminiError(await describeError(startRes), startRes.status >= 500 || startRes.status === 429);
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new GeminiError("Gemini upload URL missing.", true);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(buffer),
  });
  if (!uploadRes.ok) throw new GeminiError(await describeError(uploadRes), uploadRes.status >= 500 || uploadRes.status === 429);
  const json = (await uploadRes.json()) as { file?: { uri?: string; name?: string; state?: string } };
  if (!json.file?.uri || !json.file?.name) throw new GeminiError("Gemini upload returned no file.", true);
  return { uri: json.file.uri, name: json.file.name };
}

/** Poll the file resource until ACTIVE (or FAILED). */
export async function pollGeminiFile(name: string, apiKey: string, timeoutMs = 180000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/v1beta/files/${encodeURIComponent(name)}?key=${encodeURIComponent(apiKey)}`);
    if (res.ok) {
      const json = (await res.json()) as { state?: string; error?: { message?: string } };
      if (json.state === "ACTIVE") return;
      if (json.state === "FAILED") throw new GeminiError("Gemini failed to process the reference video.");
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new GeminiError("Timed out waiting for Gemini to process the reference video.", true);
}

export async function deleteGeminiFile(name: string, apiKey: string): Promise<void> {
  await fetch(`${BASE}/v1beta/files/${encodeURIComponent(name)}?key=${encodeURIComponent(apiKey)}`, { method: "DELETE" }).catch(() => {});
}

export async function testGeminiKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE}/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`);
    if (res.ok) return { ok: true, message: "Key is valid." };
    if (res.status === 400 || res.status === 403) return { ok: false, message: "Key was rejected by Google (invalid or API disabled)." };
    return { ok: false, message: `Gemini responded with HTTP ${res.status}.` };
  } catch {
    return { ok: false, message: "Network error while contacting Gemini." };
  }
}

async function describeError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return j.error?.message ? `Gemini: ${j.error.message}` : `Gemini HTTP ${res.status}`;
  } catch {
    return `Gemini HTTP ${res.status}`;
  }
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          duration_seconds: { type: "integer" },
          image_prompt: { type: "string" },
          video_prompt: { type: "string" },
          dialogue: { type: "string" },
          camera: { type: "string" },
          transition: { type: "string" },
        },
        required: ["title", "duration_seconds", "image_prompt", "video_prompt", "dialogue", "camera", "transition"],
      },
    },
  },
  required: ["title", "scenes"],
} as const;

function buildInstruction(opts: {
  idea: string;
  sceneCount: number;
  languageName: string;
  nativeName: string;
  hasVideo: boolean;
}): string {
  const { idea, sceneCount, languageName, nativeName, hasVideo } = opts;
  return `You are the CHAFIKTECH video prompt engine — a senior AI video director and world-class prompt engineer for text-to-image and text-to-video models (Veo, Sora, Runway, Kling, Midjourney).

TASK
Generate exactly ${sceneCount} sequential scenes for one cohesive short-form vertical video (aspect ratio 9:16) based on the user's idea below${hasVideo ? " and the attached reference video" : ""}.

${hasVideo ? `REFERENCE VIDEO
A reference video is attached for guidance. Before writing anything, deeply analyze it: visual style, color grading, lighting, camera movement, pacing, editing rhythm, mood, wardrobe, locations and subject matter. Carry this style DNA into every scene so the final video feels like a sequel to the reference, keeping the user's idea as the story.` : ""}

USER'S IDEA
"""
${idea}
"""

HARD RULES
1. Exactly ${sceneCount} scenes, numbered 1..${sceneCount}, telling one continuous story with a hook in scene 1 and a payoff in the final scene.
2. Each scene duration_seconds must be between 4 and 12.
3. image_prompt: a complete text-to-image prompt written in ${languageName} (${nativeName}). Describe composition, subject, environment, lighting, color palette, lens and film style, mood and quality keywords. 40-90 words. Do not include text overlays or watermarks.
4. video_prompt: a text-to-video motion prompt written in ${languageName} (${nativeName}). Describe subject motion, camera movement, action beats and atmosphere for that scene. 30-70 words.
5. dialogue: one short spoken line or voice-over line written in ${languageName} (${nativeName}), natural and punchy. Use "" (empty string) if the scene has no speech.
6. camera: short English shot description (e.g. "slow dolly-in, medium close-up, 35mm").
7. transition: short English note on how this scene flows into the next (e.g. "whip pan match cut").
8. Keep a consistent main character across scenes: same wardrobe, same defining features; mention the shared description inside every image_prompt so generated images stay consistent.
9. Prompts must be self-contained (no references like "as before" or "same as scene 1").
10. Output ONLY valid JSON matching the provided schema. No markdown, no commentary.`;
}

export type GeneratedScenes = {
  title: string;
  scenes: {
    title: string;
    duration_seconds: number;
    image_prompt: string;
    video_prompt: string;
    dialogue: string;
    camera: string;
    transition: string;
  }[];
};

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new GeminiError("Gemini returned an unparseable response.");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function generateScenes(opts: {
  idea: string;
  sceneCount: number;
  languageName: string;
  nativeName: string;
  hasVideo: boolean;
  videoUri?: string;
  videoMime?: string;
  model: string;
  apiKey: string;
}): Promise<GeneratedScenes> {
  const parts: Record<string, unknown>[] = [];
  if (opts.videoUri) {
    parts.push({ file_data: { mime_type: opts.videoMime, file_uri: opts.videoUri } });
  }
  parts.push({ text: buildInstruction(opts) });

  let lastError: GeminiError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.8, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    });

    if (!res.ok) {
      const msg = await describeError(res);
      lastError = new GeminiError(msg, res.status === 429 || res.status >= 500);
      if (!lastError.transient) throw lastError;
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (json.promptFeedback?.blockReason) {
      throw new GeminiError(`The idea was blocked by safety filters (${json.promptFeedback.blockReason}). Please rephrase it.`);
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) {
      lastError = new GeminiError("Gemini returned an empty response.", true);
      continue;
    }
    const parsed = extractJson(text) as GeneratedScenes;
    if (!parsed || !Array.isArray(parsed.scenes)) throw new GeminiError("Gemini returned an unexpected structure.");
    return parsed;
  }
  throw lastError ?? new GeminiError("Gemini request failed.", true);
}

export { BASE as GEMINI_BASE };
