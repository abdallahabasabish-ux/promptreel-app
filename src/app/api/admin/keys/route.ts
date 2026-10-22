import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError, readJson, str } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

function mask(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export async function GET() {
  try {
    await requireAdmin();
    const keys = await db.geminiKey.findMany({ orderBy: { createdAt: "asc" } });
    return ok({
      keys: keys.map((k) => ({
        id: k.id, label: k.label, masked: mask(k.key), isActive: k.isActive,
        lastStatus: k.lastStatus, lastError: k.lastError, lastCheckedAt: k.lastCheckedAt,
        createdAt: k.createdAt,
      })),
      envKey: !!process.env.GEMINI_API_KEY,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await readJson<{ key?: string; label?: string }>(req);
    const key = str(body.key, "API key", { min: 20, max: 200 });
    const label = str(body.label, "Label", { min: 1, max: 60, optional: true }) || `Key ${new Date().toISOString().slice(0, 10)}`;
    const created = await db.geminiKey.create({ data: { key, label } });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "gemini_key.create", detail: label } });
    return ok({ id: created.id, masked: mask(key) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
