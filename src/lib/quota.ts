import { db } from "@/lib/db";

export type UsageInfo = {
  used: number;
  limit: number; // -1 = unlimited
  planName: string;
  planSlug: string;
  maxVideoMb: number;
  periodEnd: string | null;
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getUsage(userId: string): Promise<UsageInfo> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { plan: true } });
  const used = await db.project.count({
    where: { userId, status: "succeeded", createdAt: { gte: startOfMonth() } },
  });
  const plan = user?.plan;
  return {
    used,
    limit: plan ? plan.monthlyGenerations : 0,
    planName: plan?.name ?? "No plan",
    planSlug: plan?.slug ?? "none",
    maxVideoMb: plan?.maxVideoMb ?? 0,
    periodEnd: user?.planPeriodEnd ? user.planPeriodEnd.toISOString() : null,
  };
}

export function monthStart(): Date {
  return startOfMonth();
}
