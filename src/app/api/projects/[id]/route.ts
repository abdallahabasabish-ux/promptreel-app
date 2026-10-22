import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { removeUpload } from "@/lib/video";

async function getOwnedProject(id: string, userId: string) {
  const project = await db.project.findUnique({ where: { id }, include: { video: true, scenes: { orderBy: { idx: "asc" } } } });
  if (!project || project.userId !== userId) throw new ApiError(404, "not_found", "Generation not found.");
  return project;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user.id);
    return ok({
      project: {
        id: project.id,
        title: project.title,
        idea: project.idea,
        sceneCount: project.sceneCount,
        languageCode: project.languageCode,
        languageName: project.languageName,
        status: project.status,
        progress: project.progress,
        statusMessage: project.statusMessage,
        modelUsed: project.modelUsed,
        error: project.error,
        shareEnabled: project.shareEnabled,
        shareToken: project.shareToken,
        hasVideo: project.hasVideo,
        video: project.video ? { filename: project.video.filename, sizeBytes: project.video.sizeBytes } : null,
        createdAt: project.createdAt,
        completedAt: project.completedAt,
        scenes: project.scenes.map((s) => ({
          idx: s.idx,
          title: s.title,
          durationSec: s.durationSec,
          imagePrompt: s.imagePrompt,
          videoPrompt: s.videoPrompt,
          dialogue: s.dialogue,
          camera: s.camera,
          transition: s.transition,
        })),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await getOwnedProject(id, user.id);
    if (project.video) await removeUpload(project.video.storedPath).catch(() => {});
    await db.project.delete({ where: { id: project.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
