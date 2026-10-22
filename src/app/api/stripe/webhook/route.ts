import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function addDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ ok: false, error: { code: "not_configured" } }, { status: 503 });
  }

  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(payload, sig, webhookSecret)) {
    return NextResponse.json({ ok: false, error: { code: "bad_signature" } }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Idempotency: skip already-processed events
  const existing = await db.paymentEvent.findUnique({ where: { id: event.id } });
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        metadata?: Record<string, string>;
        customer?: string;
        subscription_details?: { metadata?: Record<string, string> };
      };
      const userId = session.metadata?.userId ?? session.subscription_details?.metadata?.userId;
      const planId = session.metadata?.planId ?? session.subscription_details?.metadata?.planId;
      if (userId && planId) {
        const plan = await db.plan.findUnique({ where: { id: planId } });
        if (plan) {
          await db.user.update({
            where: { id: userId },
            data: {
              planId: plan.id,
              planPeriodEnd: addDays(31),
              stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            },
          });
        }
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as { customer?: string; period_end?: number };
      if (typeof invoice.customer === "string") {
        const user = await db.user.findFirst({ where: { stripeCustomerId: invoice.customer } });
        if (user) {
          const end = invoice.period_end ? new Date(invoice.period_end * 1000) : addDays(31);
          await db.user.update({ where: { id: user.id }, data: { planPeriodEnd: end } });
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as { customer?: string };
      if (typeof sub.customer === "string") {
        const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
        if (user) {
          const free = await db.plan.findFirst({ where: { isActive: true, slug: "free" } });
          await db.user.update({ where: { id: user.id }, data: { planId: free?.id } });
        }
      }
    }

    await db.paymentEvent.create({ data: { id: event.id, type: event.type, payload: payload.slice(0, 20000) } });
  } catch (e) {
    console.error("[stripe-webhook] handler error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
