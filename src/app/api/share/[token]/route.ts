import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";

/** Public share endpoint — read-only, no auth, no user info. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 10) return fail(404, "not_found", "Shared generation not found.");
    const project = await db.project.findUnique({
      where: { shareToken: token },
      include: { scenes: { orderBy: { idx: "asc" } } },
    });
    if (!project || !project.shareEnabled) return fail(404, "not_found", "This share link is disabled or no longer exists.");
    return ok({
      project: {
        title: project.title,
        sceneCount: project.sceneCount,
        languageName: project.languageName,
        createdAt: project.createdAt,
        scenes: project.scenes.map((s) => ({
          idx: s.idx, title: s.title, durationSec: s.durationSec,
          imagePrompt: s.imagePrompt, videoPrompt: s.videoPrompt,
          dialogue: s.dialogue, camera: s.camera, transition: s.transition,
        })),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
