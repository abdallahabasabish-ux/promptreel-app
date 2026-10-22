import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { requireAdmin, destroyAllSessions } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await readJson<{ planId?: string; status?: string; role?: string }>(req);

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return fail(404, "not_found", "User not found.");

    const data: Record<string, unknown> = {};
    if (body.planId !== undefined) {
      if (body.planId === "") {
        data.planId = null;
      } else {
        const plan = await db.plan.findUnique({ where: { id: body.planId } });
        if (!plan) return fail(400, "validation_error", "Plan not found.");
        data.planId = plan.id;
        data.planPeriodEnd = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      }
    }
    if (body.status !== undefined) {
      if (!["active", "banned"].includes(body.status)) return fail(400, "validation_error", "Invalid status.");
      if (target.id === admin.id && body.status === "banned") return fail(400, "validation_error", "You cannot ban yourself.");
      data.status = body.status;
      if (body.status === "banned") await destroyAllSessions(target.id);
    }
    if (body.role !== undefined) {
      if (!["user", "admin"].includes(body.role)) return fail(400, "validation_error", "Invalid role.");
      if (target.id === admin.id && body.role !== "admin") return fail(400, "validation_error", "You cannot remove your own admin role.");
      data.role = body.role;
    }

    const updated = await db.user.update({ where: { id }, data });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "user.update", detail: `${updated.email}: ${JSON.stringify(body)}` } });
    return ok({ id: updated.id, role: updated.role, status: updated.status, planId: updated.planId });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) return fail(400, "validation_error", "You cannot delete your own account from here.");
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return fail(404, "not_found", "User not found.");
    await db.user.delete({ where: { id } });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "user.delete", detail: target.email } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
