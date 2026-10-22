import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await readJson<{ isActive?: boolean; label?: string }>(req);
    const data: Record<string, unknown> = {};
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.label !== undefined) data.label = String(body.label).slice(0, 60);
    const updated = await db.geminiKey.update({ where: { id }, data });
    return ok({ id: updated.id, isActive: updated.isActive, label: updated.label });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await db.geminiKey.delete({ where: { id } });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "gemini_key.delete", detail: id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
