import { createHmac, timingSafeEqual } from "crypto";

const API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function secret(): string {
  const s = process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error("Stripe not configured");
  return s;
}

async function stripePost(params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Stripe HTTP ${res.status}`);
  return json;
}

export async function createCheckoutSession(opts: {
  planId: string;
  planName: string;
  priceCents: number;
  currency: string;
  userId: string;
  userEmail: string;
  origin: string;
}): Promise<{ url: string; sessionId: string }> {
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": opts.currency,
    "line_items[0][price_data][unit_amount]": String(opts.priceCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `CHAFIKTECH ${opts.planName}`,
    "line_items[0][price_data][product_data][description]": "AI Video Scene Prompt Generator subscription",
    customer_email: opts.userEmail,
    client_reference_id: opts.userId,
    success_url: `${opts.origin}/?billing=success`,
    cancel_url: `${opts.origin}/?billing=cancelled`,
    "metadata[userId]": opts.userId,
    "metadata[planId]": opts.planId,
    "subscription_data[metadata][userId]": opts.userId,
    "subscription_data[metadata][planId]": opts.planId,
  };
  const json = (await stripePost(params)) as { id?: string; url?: string };
  if (!json.url || !json.id) throw new Error("Stripe checkout session failed.");
  return { url: json.url, sessionId: json.id };
}

export async function createPortalSession(customerId: string, origin: string): Promise<{ url: string }> {
  const json = (await stripePost({
    customer: customerId,
    return_url: `${origin}/?billing=portal`,
  })) as { url?: string };
  if (!json.url) throw new Error("Stripe portal session failed.");
  return { url: json.url };
}

/** Verify a Stripe webhook signature header (t=...,v1=...). */
export function verifyStripeSignature(payload: string, header: string, webhookSecret: string): boolean {
  try {
    const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
    const timestamp = parts["t"];
    const signatures = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
    if (!timestamp || signatures.length === 0) return false;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;
    const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${payload}`).digest("hex");
    return signatures.some((sig) => {
      const a = Buffer.from(sig, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && timingSafeEqual(a, b);
    });
  } catch {
    return false;
  }
}
