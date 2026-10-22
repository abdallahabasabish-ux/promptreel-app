import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { requireUser, destroyAllSessions } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { removeUpload } from "@/lib/video";

/** GDPR-style account deletion: re-auth, then anonymize + cascade cleanup. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson<{ password?: string }>(req).catch(() => ({ password: undefined }));

    if (user.passwordHash) {
      if (!body.password || !verifyPassword(String(body.password), user.passwordHash)) {
        return fail(401, "reauth_failed", "Please enter your current password to delete your account.");
      }
    }

    // Remove stored reference videos from disk
    const videos = await db.referenceVideo.findMany({ where: { userId: user.id } });
    for (const v of videos) await removeUpload(v.storedPath).catch(() => {});

    await destroyAllSessions(user.id);
    await db.user.delete({ where: { id: user.id } }); // cascades sessions, projects, scenes, videos
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
