import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str, int, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getUsage } from "@/lib/quota";
import { getSettings } from "@/lib/settings";
import { runGeneration } from "@/lib/pipeline";

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await db.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, status: true, sceneCount: true, languageName: true,
        hasVideo: true, shareEnabled: true, createdAt: true, completedAt: true,
      },
      take: 200,
    });
    return ok({ projects });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const settings = await getSettings();
    if (settings.maintenanceMode && user.role !== "admin") {
      return fail(503, "maintenance", "CHAFIKTECH is in maintenance mode. Please try again soon.");
    }

    const body = await readJson<{ idea?: string; sceneCount?: number; languageCode?: string; videoId?: string }>(req);
    const idea = str(body.idea, "Idea", { min: 0, max: 4000 });
    const sceneCount = int(body.sceneCount, "Scene count", { min: 1, max: 8 });
    const languageCode = str(body.languageCode, "Language", { max: 12 });
    const videoId = typeof body.videoId === "string" && body.videoId ? body.videoId : null;

    const language = await db.promptLanguage.findUnique({ where: { code: languageCode } });
    if (!language || !language.isActive) return fail(400, "validation_error", "Please pick a valid prompt language.");

    if (!videoId && idea.trim().length < 12) {
      return fail(400, "validation_error", "Describe your video idea in at least 12 characters, or attach a reference video.");
    }

    // Quota check (succeeded generations this month vs plan)
    const usage = await getUsage(user.id);
    if (usage.limit !== -1 && usage.used >= usage.limit) {
      return fail(402, "quota_exceeded", `You've used all ${usage.limit} generations of the ${usage.planName} plan this month. Upgrade to keep creating.`);
    }

    // One active generation at a time per user
    const active = await db.project.findFirst({ where: { userId: user.id, status: { in: ["queued", "running"] } } });
    if (active) return fail(429, "busy", "You already have a generation running. Wait for it to finish.");

    let video: { id: string; mimeType: string } | null = null;
    if (videoId) {
      const v = await db.referenceVideo.findUnique({ where: { id: videoId } });
      if (!v || v.userId !== user.id || v.projectId) return fail(400, "validation_error", "Reference video not found. Upload it again.");
      video = { id: v.id, mimeType: v.mimeType };
    }

    const title = (idea.trim() || "Reference video generation").slice(0, 60) || "New generation";
    const project = await db.project.create({
      data: {
        userId: user.id,
        title,
        idea: idea.trim(),
        sceneCount,
        languageCode: language.code,
        languageName: language.nativeName,
        hasVideo: !!video,
      },
    });

    if (video) {
      await db.referenceVideo.update({ where: { id: video.id }, data: { projectId: project.id } });
    }

    // Fire-and-forget pipeline (progress tracked in DB, polled by the client)
    void runGeneration(project.id).catch((e) => console.error("[pipeline] crash:", e));

    return ok({ projectId: project.id }, 201);
  } catch (e) {
    return handleError(e);
  }
}
