import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function GET() {
  try {
    const plans = await db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return ok({
      plans: plans.map((p) => ({
        id: p.id, name: p.name, slug: p.slug, description: p.description,
        priceCents: p.priceCents, currency: p.currency,
        monthlyGenerations: p.monthlyGenerations, maxVideoMb: p.maxVideoMb,
        features: JSON.parse(p.features || "[]"),
      })),
    });
  } catch {
    return ok({ plans: [] });
  }
}
