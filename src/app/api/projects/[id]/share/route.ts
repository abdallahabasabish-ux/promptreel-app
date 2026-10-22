import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { requireUser, randomToken } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await readJson<{ enabled?: boolean }>(req);
    const enabled = !!body.enabled;

    const project = await db.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) return fail(404, "not_found", "Generation not found.");

    const updated = await db.project.update({
      where: { id },
      data: {
        shareEnabled: enabled,
        shareToken: enabled ? (project.shareToken ?? randomToken(16)) : project.shareToken,
      },
    });
    return ok({ shareEnabled: updated.shareEnabled, shareToken: updated.shareToken });
  } catch (e) {
    return handleError(e);
  }
}
