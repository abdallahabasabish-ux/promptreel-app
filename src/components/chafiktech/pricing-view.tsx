"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, Sparkles, Zap, Building2, CreditCard } from "lucide-react";
import { LogoMark } from "@/components/chafiktech/logo";
import { api, ApiClientError, type Plan, type Usage, type Flags } from "@/lib/client";
import { toast } from "sonner";

export function PricingView({
  plans,
  usage,
  flags,
  onBack,
  refreshBoot,
  onRequireSignIn,
}: {
  plans: Plan[];
  usage: Usage | null;
  flags: Flags;
  onBack: () => void;
  refreshBoot: () => Promise<void>;
  onRequireSignIn?: () => void;
}) {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  async function checkout(plan: Plan) {
    setBusyPlan(plan.id);
    try {
      const res = await api<{ checkoutUrl: string }>("/api/billing/checkout", { method: "POST", json: { planId: plan.id } });
      window.open(res.checkoutUrl, "_self");
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 401 || e.code === "unauthorized")) {
        onRequireSignIn?.();
        toast.info("Sign in to upgrade your plan.");
      } else {
        toast.error(e instanceof ApiClientError ? e.message : "Checkout failed.", { duration: 5000 });
      }
      setBusyPlan(null);
    }
  }

  const icons = [Sparkles, Zap, Building2];
  const currentPlanId = plans.find((p) => p.slug === usage?.planSlug)?.id;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm" className="gap-1.5 font-semibold" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex-1" />
          <LogoMark className="h-8 w-8" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Plans that scale with your <span className="text-primary">creativity</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
            Every plan includes all admin-enabled prompt languages, 1–8 scenes per generation, exports and share links.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan, i) => {
            const Icon = icons[i % icons.length];
            const isCurrent = plan.id === currentPlanId;
            const features = Array.isArray(plan.features) ? plan.features : [];
            return (
              <div key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${
                  plan.slug === "pro" ? "border-primary/50 ring-1 ring-primary/30" : ""
                }`}>
                {plan.slug === "pro" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-primary-foreground shadow">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h2 className="text-lg font-extrabold">{plan.name}</h2>
                </div>
                <p className="mt-2 min-h-10 text-[12.5px] text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    ${(plan.priceCents / 100).toFixed(0)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">/ month</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full font-bold"
                  variant={plan.slug === "pro" ? "default" : "outline"}
                  disabled={isCurrent || (plan.priceCents > 0 && busyPlan === plan.id)}
                  onClick={() => (plan.priceCents === 0 ? onBack() : checkout(plan))}
                >
                  {busyPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      {isCurrent ? "Current plan" : plan.priceCents === 0 ? "Start free" : `Upgrade to ${plan.name}`}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {!flags.stripe && (
          <p className="mx-auto mt-8 max-w-xl rounded-xl border bg-muted/40 px-4 py-3 text-center text-[12.5px] text-muted-foreground">
            Card payments are almost ready — the administrator activates them by adding Stripe keys. Need a plan now? The admin can assign it to your account manually from the admin panel.
          </p>
        )}
      </main>
    </div>
  );
}
