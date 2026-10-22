import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { monthStart } from "@/lib/quota";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    const where = q
      ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
      : {};
    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { plan: { select: { id: true, name: true, slug: true } }, _count: { select: { projects: true } } },
    });
    const ms = monthStart();
    const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } });
    const usageRows = await db.project.groupBy({
      by: ["userId"],
      where: { status: "succeeded", createdAt: { gte: ms } },
      _count: { _all: true },
    });
    const usageMap = new Map(usageRows.map((r) => [r.userId, r._count._all]));

    return ok({
      users: users.map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
        emailVerified: !!u.emailVerifiedAt, plan: u.plan, projects: u._count.projects,
        usedThisMonth: usageMap.get(u.id) ?? 0, createdAt: u.createdAt,
      })),
      plans,
    });
  } catch (e) {
    return handleError(e);
  }
}
