import { ok, handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthStart } from "@/lib/quota";

export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();
    const ms = monthStart();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, newUsers, gensMonth, gensTotal, succeeded, failed, activeWeek, paidPlanUsers, recent] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: ms } } }),
      db.project.count({ where: { createdAt: { gte: ms } } }),
      db.project.count(),
      db.project.count({ where: { status: "succeeded", createdAt: { gte: ms } } }),
      db.project.count({ where: { status: "failed", createdAt: { gte: ms } } }),
      db.user.count({ where: { projects: { some: { createdAt: { gte: weekAgo } } } } }),
      db.user.findMany({ where: { plan: { priceCents: { gt: 0 } }, planPeriodEnd: { gte: now } }, include: { plan: true } }),
      db.project.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: { select: { email: true, name: true } } },
      }),
    ]);

    const mrrCents = paidPlanUsers.reduce((sum, u) => sum + (u.plan?.priceCents ?? 0), 0);

    return ok({
      stats: {
        totalUsers,
        newUsersThisMonth: newUsers,
        generationsThisMonth: gensMonth,
        generationsTotal: gensTotal,
        succeededThisMonth: succeeded,
        failedThisMonth: failed,
        activeUsersWeek: activeWeek,
        mrrCents,
      },
      recent: recent.map((p) => ({
        id: p.id, title: p.title, status: p.status, sceneCount: p.sceneCount,
        languageName: p.languageName, createdAt: p.createdAt,
        user: p.user.email, hasVideo: p.hasVideo,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
