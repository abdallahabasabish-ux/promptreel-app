import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError, readJson, str, int, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return ok({ plans });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name, "Name", { min: 2, max: 40 });
    const slug = str(body.slug, "Slug", { min: 2, max: 40 }).toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const exists = await db.plan.findUnique({ where: { slug } });
    if (exists) throw new ApiError(409, "slug_taken", "A plan with this slug already exists.");
    const plan = await db.plan.create({
      data: {
        name,
        slug,
        description: str(body.description, "Description", { max: 200, optional: true }),
        priceCents: int(body.priceCents, "Price", { min: 0, max: 100000000, fallback: 0 }),
        monthlyGenerations: int(body.monthlyGenerations, "Monthly generations", { min: -1, max: 1000000, fallback: 10 }),
        maxVideoMb: int(body.maxVideoMb, "Max video MB", { min: 0, max: 10240, fallback: 50 }),
        features: JSON.stringify(Array.isArray(body.features) ? body.features : String(body.features ?? "").split("\n").map((s) => s.trim()).filter(Boolean)),
        sortOrder: int(body.sortOrder, "Sort order", { min: 0, max: 999, fallback: 10 }),
      },
    });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "plan.create", detail: plan.slug } });
    return ok({ plan }, 201);
  } catch (e) {
    return handleError(e);
  }
}
