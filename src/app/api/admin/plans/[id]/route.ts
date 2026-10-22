import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str, int } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(req);
    const plan = await db.plan.findUnique({ where: { id } });
    if (!plan) return fail(404, "not_found", "Plan not found.");

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = str(body.name, "Name", { min: 2, max: 40 });
    if (body.description !== undefined) data.description = str(body.description, "Description", { max: 200, optional: true });
    if (body.priceCents !== undefined) data.priceCents = int(body.priceCents, "Price", { min: 0, max: 100000000 });
    if (body.monthlyGenerations !== undefined) data.monthlyGenerations = int(body.monthlyGenerations, "Monthly generations", { min: -1, max: 1000000 });
    if (body.maxVideoMb !== undefined) data.maxVideoMb = int(body.maxVideoMb, "Max video MB", { min: 0, max: 10240 });
    if (body.sortOrder !== undefined) data.sortOrder = int(body.sortOrder, "Sort order", { min: 0, max: 999 });
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.isDefault !== undefined) {
      data.isDefault = !!body.isDefault;
      if (data.isDefault) {
        await db.plan.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
        const settings = await db.appSetting.findUnique({ where: { key: "defaultPlanSlug" } });
        if (settings) await db.appSetting.update({ where: { key: "defaultPlanSlug" }, data: { value: JSON.stringify(plan.slug) } });
      }
    }
    if (body.features !== undefined) {
      data.features = JSON.stringify(Array.isArray(body.features) ? body.features : String(body.features).split("\n").map((s) => s.trim()).filter(Boolean));
    }

    const updated = await db.plan.update({ where: { id }, data });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "plan.update", detail: updated.slug } });
    return ok({ plan: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const plan = await db.plan.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!plan) return fail(404, "not_found", "Plan not found.");
    if (plan._count.users > 0) {
      const updated = await db.plan.update({ where: { id }, data: { isActive: false } });
      await db.adminLog.create({ data: { adminUserId: admin.id, action: "plan.deactivate", detail: `${plan.slug} (${plan._count.users} users)` } });
      return ok({ deactivated: true, plan: updated, message: `Plan has ${plan._count.users} users — deactivated instead of deleted.` });
    }
    await db.plan.delete({ where: { id } });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "plan.delete", detail: plan.slug } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
