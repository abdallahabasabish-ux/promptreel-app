import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { ApiError } from "@/lib/api";

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads");

export const ALLOWED_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type SniffResult = { mime: string; container: string } | { error: string };

/** Content-authoritative container sniffing (magic bytes), like the Phase 3 pipeline. */
export function sniffVideo(head: Buffer): SniffResult {
  if (head.length < 12) return { error: "File too small to be a video." };
  // ISO-BMFF (MP4/MOV): box size at 0..4, "ftyp" at 4..8, brand at 8..12
  if (head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    const mp4Brands = ["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "msdh", "msd2", "m4v ", "m4v1", "mp71", "mpr "];
    if (brand === "qt  ") return { mime: "video/quicktime", container: "mov" };
    if (mp4Brands.includes(brand)) return { mime: "video/mp4", container: "mp4" };
    // Some Android recorders use exotic brands; accept any ftyp whose major brand starts with iso/mp/m4/m
    if (/^(iso|mp|m4|m)/i.test(brand)) return { mime: "video/mp4", container: "mp4" };
    return { error: `Unsupported MP4 brand "${brand.replace(/[^\x20-\x7e]/g, "")}".` };
  }
  // WebM / Matroska (EBML magic 0x1A45DFA3) then DocType string
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    const s = head.subarray(0, Math.min(head.length, 64)).toString("latin1");
    if (s.includes("webm")) return { mime: "video/webm", container: "webm" };
    return { error: "Matroska containers are not supported. Please upload MP4, MOV or WebM." };
  }
  return { error: "This file is not a supported video (MP4, MOV or WebM required)." };
}

export async function saveUpload(userId: string, file: File, durationHint?: number) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const head = buffer.subarray(0, Math.min(buffer.length, 64));
  const sniff = sniffVideo(head);
  if ("error" in sniff) throw new ApiError(400, "bad_video", sniff.error);

  await mkdir(UPLOAD_DIR, { recursive: true });
  const stored = `${Date.now()}-${randomBytes(12).toString("hex")}.${sniff.container}`;
  const storedPath = path.join(UPLOAD_DIR, stored);
  await writeFile(storedPath, buffer);

  const ext = sniff.container;
  return {
    filename: file.name || `reference.${ext}`,
    storedPath,
    mimeType: sniff.mime,
    sizeBytes: buffer.length,
    durationHint: durationHint && durationHint > 0 ? durationHint : null,
  };
}

export async function readUpload(storedPath: string): Promise<Buffer | null> {
  try {
    return await readFile(storedPath);
  } catch {
    return null;
  }
}

export async function removeUpload(storedPath: string): Promise<void> {
  await unlink(storedPath).catch(() => {});
}

/** Sweep orphan uploads older than 48h that are not attached to any project. */
export async function sweepOrphanUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const orphans = await (await import("@/lib/db")).db.referenceVideo.findMany({
    where: { projectId: null, createdAt: { lt: cutoff }, cleanedAt: null },
  });
  for (const v of orphans) {
    await removeUpload(v.storedPath);
    await (await import("@/lib/db")).db.referenceVideo.update({ where: { id: v.id }, data: { cleanedAt: new Date() } });
  }
  return orphans.length;
}
