import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str, int } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = str(body.name, "Name", { min: 2, max: 40 });
    if (body.nativeName !== undefined) data.nativeName = str(body.nativeName, "Native name", { min: 1, max: 40 });
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.sortOrder !== undefined) data.sortOrder = int(body.sortOrder, "Sort order", { min: 0, max: 999 });
    const updated = await db.promptLanguage.update({ where: { id }, data });
    return ok({ language: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const inUse = await db.project.count({ where: { languageCode: (await db.promptLanguage.findUnique({ where: { id } }))?.code ?? "" } });
    if (inUse > 0) {
      const updated = await db.promptLanguage.update({ where: { id }, data: { isActive: false } });
      await db.adminLog.create({ data: { adminUserId: admin.id, action: "language.deactivate", detail: `${updated.code} (${inUse} projects)` } });
      return ok({ deactivated: true, message: `Language used by ${inUse} projects — deactivated instead of deleted.` });
    }
    const lang = await db.promptLanguage.findUnique({ where: { id } });
    if (!lang) return fail(404, "not_found", "Language not found.");
    await db.promptLanguage.delete({ where: { id } });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "language.delete", detail: lang.code } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
