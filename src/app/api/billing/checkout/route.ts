import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!stripeConfigured()) {
      return fail(503, "payments_unavailable", "Payments are not configured yet. The administrator can assign plans manually from the admin panel.");
    }
    const body = await readJson<{ planId?: string }>(req);
    const plan = await db.plan.findUnique({ where: { id: body.planId || "" } });
    if (!plan || !plan.isActive) return fail(400, "validation_error", "Plan not found.");
    if (plan.priceCents === 0) return fail(400, "validation_error", "The Free plan does not require checkout.");
    if (user.planId === plan.id) return fail(400, "validation_error", `You are already on ${plan.name}.`);

    const origin = req.nextUrl.origin;
    const session = await createCheckoutSession({
      planId: plan.id,
      planName: plan.name,
      priceCents: plan.priceCents,
      currency: plan.currency,
      userId: user.id,
      userEmail: user.email,
      origin,
    });
    return ok({ checkoutUrl: session.url });
  } catch (e) {
    return handleError(e);
  }
}
