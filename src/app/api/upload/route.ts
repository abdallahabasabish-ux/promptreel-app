import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getUsage } from "@/lib/quota";
import { getSettings } from "@/lib/settings";
import { saveUpload, removeUpload } from "@/lib/video";

export const runtime = "nodejs";

/**
 * POST /api/upload — reference video upload (multipart/form-data: video, duration?)
 * Size is enforced against the user's plan limit BEFORE buffering the file.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const settings = await getSettings();
    if (settings.maintenanceMode && user.role !== "admin") {
      return fail(503, "maintenance", "CHAFIKTECH is in maintenance mode. Please try again soon.");
    }

    const usage = await getUsage(user.id);
    const maxBytes = usage.maxVideoMb * 1024 * 1024;

    // Fast pre-check via Content-Length before parsing the body when possible.
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared && declared > maxBytes + 64 * 1024) {
      return fail(413, "too_large", `Reference videos are limited to ${usage.maxVideoMb} MB on your plan.`);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(400, "bad_request", "Upload failed. Please try again.");
    }

    const file = form.get("video");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, "validation_error", "Please choose a video file to upload.");
    }
    if (file.size > maxBytes) {
      return fail(413, "too_large", `Reference videos are limited to ${usage.maxVideoMb} MB on your plan.`);
    }

    // Reject absurd durations early (7 days) to keep hint fields sane.
    const durationRaw = Number(form.get("duration"));
    const durationHint = Number.isFinite(durationRaw) && durationRaw > 0 && durationRaw < 604800 ? durationRaw : undefined;

    const saved = await saveUpload(user.id, file, durationHint);

    const record = await db.referenceVideo.create({
      data: {
        userId: user.id,
        filename: saved.filename,
        storedPath: saved.storedPath,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        durationHint: saved.durationHint,
      },
    });

    return ok({ videoId: record.id, filename: saved.filename, sizeBytes: saved.sizeBytes }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/upload?id=<videoId> — remove an unattached reference video. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail(400, "validation_error", "Missing video id.");

    const v = await db.referenceVideo.findUnique({ where: { id } });
    if (!v || v.userId !== user.id) return fail(404, "not_found", "Video not found.");
    if (v.projectId) return fail(409, "attached", "This video is already attached to a generation.");

    await removeUpload(v.storedPath);
    await db.referenceVideo.delete({ where: { id: v.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
