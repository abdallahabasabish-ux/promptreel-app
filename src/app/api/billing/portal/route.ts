import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPortalSession, stripeConfigured } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!stripeConfigured()) return fail(503, "payments_unavailable", "Payments are not configured yet.");
    if (!user.stripeCustomerId) return fail(400, "no_customer", "No Stripe billing profile found for your account yet.");
    const origin = req.headers.get("origin") || req.nextUrl.origin;
    const session = await createPortalSession(user.stripeCustomerId, origin);
    return ok({ portalUrl: session.url });
  } catch (e) {
    return handleError(e);
  }
}
