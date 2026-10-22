"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, type Boot, type Flags, type Usage } from "@/lib/client";
import { LogoMark } from "@/components/chafiktech/logo";
import { AuthView } from "@/components/chafiktech/auth-view";
import { Workspace } from "@/components/chafiktech/workspace";
import { PricingView } from "@/components/chafiktech/pricing-view";
import { ShareView } from "@/components/chafiktech/share-view";
import { AdminView } from "@/components/chafiktech/admin-view";
import { toast } from "sonner";

type View = "boot" | "auth" | "workspace" | "pricing" | "share" | "admin";

const DEFAULT_FLAGS: Flags = {
  googleOAuth: false,
  stripe: false,
  smtp: false,
  exposeDevLinks: false,
  emailVerificationRequired: false,
  maintenanceMode: false,
};

const DEFAULT_USAGE: Usage = {
  used: 0,
  limit: 10,
  planName: "Free",
  planSlug: "free",
  maxVideoMb: 50,
  periodEnd: null,
};

function readQuery(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function Page() {
  const [view, setView] = useState<View>("boot");
  const [boot, setBoot] = useState<Boot | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const { setTheme } = useTheme();

  const applyBoot = useCallback(async () => {
    const res = await api<Boot>("/api/auth/me");
    setBoot(res);
    if (res.user) {
      // Follow the saved preference on every sign-in/boot
      if (res.user.theme === "light" || res.user.theme === "dark") setTheme(res.user.theme);
      setView((v) => (v === "pricing" || v === "admin" || v === "share" || v === "auth" ? v : "workspace"));
    } else {
      // Guests land straight in the tool — "auth" view is reserved for reset / OAuth-error flows
      setView((v) => (v === "auth" || v === "share" ? v : "workspace"));
    }
    return res;
  }, [setTheme]);

  // Boot + handle query params (verify / reset / share / billing / authError)
  useEffect(() => {
    void (async () => {
      const q = readQuery();
      const verify = q.get("verify");
      const reset = q.get("reset");
      const share = q.get("share");
      const billing = q.get("billing");
      const authError = q.get("authError");

      if (share) {
        setShareToken(share);
        setView("share");
        return;
      }
      if (reset) {
        setResetToken(reset);
        setView("auth");
      }
      if (authError) {
        setOauthError(authError);
        setView("auth");
        window.history.replaceState({}, "", `/`);
      }
      if (verify) {
        try {
          await api("/api/auth/verify", { method: "POST", json: { token: verify } });
          toast.success("Email verified — thank you!");
        } catch { toast.error("Verification link is invalid or expired."); }
        window.history.replaceState({}, "", "/");
      }
      if (billing === "success") {
        toast.success("Payment received — your plan is upgraded!", { duration: 6000 });
        window.history.replaceState({}, "", "/");
      } else if (billing === "cancelled") {
        toast.info("Checkout cancelled — no charge was made.");
        window.history.replaceState({}, "", "/");
      }

      try {
        await applyBoot();
      } catch {
        // Even if boot fails, show the tool in guest mode instead of a login wall
        setView((v) => (v === "auth" || v === "share" ? v : "workspace"));
      }
    })();
  }, []);

  // Hash-based admin routing (back-button support) — derived, no setState in effect
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const showAdmin = hash === "#admin" && !!boot?.user && boot.user.role === "admin";

  async function signOut() {
    await api("/api/auth/signout", { method: "POST" }).catch(() => {});
    setBoot(null);
    setAuthOpen(false);
    setView("workspace");
    toast.success("Signed out.");
  }

  async function refreshBoot() {
    await applyBoot().catch(() => {});
  }

  function handleSignedInFromDialog() {
    setAuthOpen(false);
    void refreshBoot();
  }

  if (view === "boot") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
        <LogoMark className="h-14 w-14 animate-pulse" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading CHAFIKTECH…
        </div>
      </div>
    );
  }

  if (view === "share" && shareToken) {
    return <ShareView token={shareToken} onHome={() => { setShareToken(null); window.history.replaceState({}, "", "/"); void applyBoot(); }} />;
  }

  // Full-screen auth is only used for password-reset links and OAuth errors
  if (view === "auth") {
    return (
      <AuthView
        onSignedIn={() => void refreshBoot()}
        resetToken={resetToken ?? undefined}
        authError={oauthError ?? undefined}
        flags={boot?.flags}
      />
    );
  }

  if ((view === "admin" || showAdmin) && boot?.user && boot.user.role === "admin") {
    return <AdminView onBack={() => { window.location.hash = ""; setHash(""); }} />;
  }

  const mainEl = view === "pricing" ? (
    <PricingView
      plans={boot?.plans ?? []}
      usage={boot?.usage ?? null}
      flags={boot?.flags ?? DEFAULT_FLAGS}
      onBack={() => setView("workspace")}
      refreshBoot={refreshBoot}
      onRequireSignIn={() => setAuthOpen(true)}
    />
  ) : (
    <Workspace
      user={boot?.user ?? null}
      usage={boot?.usage ?? DEFAULT_USAGE}
      flags={boot?.flags ?? DEFAULT_FLAGS}
      settings={boot?.settings ?? { welcomeMessage: "What do you want to create today?" }}
      languages={boot?.languages ?? []}
      plans={boot?.plans ?? []}
      refreshBoot={refreshBoot}
      onOpenPricing={() => { void refreshBoot(); setView("pricing"); }}
      onSignOut={signOut}
      onRequireSignIn={() => setAuthOpen(true)}
    />
  );

  return (
    <>
      {mainEl}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-w-[430px] gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Sign in to CHAFIKTECH</DialogTitle>
            <DialogDescription>Create a free account or sign in to keep using the tool.</DialogDescription>
          </DialogHeader>
          <AuthView compact onSignedIn={handleSignedInFromDialog} flags={boot?.flags} />
        </DialogContent>
      </Dialog>
    </>
  );
}
