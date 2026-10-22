"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, AlertCircle, MailCheck } from "lucide-react";
import { Logo, LogoMark } from "@/components/chafiktech/logo";
import { api, ApiClientError, type Flags } from "@/lib/client";
import { toast } from "sonner";

type Mode = "signin" | "signup" | "forgot" | "reset";

export function AuthView({
  onSignedIn,
  resetToken,
  authError,
  flags,
  compact,
}: {
  onSignedIn: () => void;
  resetToken?: string;
  authError?: string;
  flags?: Flags;
  /** Render in card-only mode (for embedding inside a dialog) */
  compact?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "signin");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", password2: "" });
  const [devLink, setDevLink] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDevLink(null);
    try {
      if (mode === "signin") {
        await api("/api/auth/signin", { method: "POST", json: { email: form.email, password: form.password } });
        toast.success("Welcome back!");
        onSignedIn();
      } else if (mode === "signup") {
        if (form.password !== form.password2) throw new Error("Passwords do not match.");
        await api("/api/auth/signup", { method: "POST", json: { name: form.name, email: form.email, password: form.password } });
        toast.success("Account created — welcome to CHAFIKTECH!");
        onSignedIn();
      } else if (mode === "forgot") {
        const res = await api<{ devResetUrl?: string }>("/api/auth/forgot", { method: "POST", json: { email: form.email } });
        setSentNotice(true);
        if (res.devResetUrl) setDevLink(res.devResetUrl);
      } else if (mode === "reset") {
        if (form.password !== form.password2) throw new Error("Passwords do not match.");
        await api("/api/auth/reset", { method: "POST", json: { token: resetToken, password: form.password } });
        toast.success("Password updated — sign in with your new password.");
        setMode("signin");
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signin" ? "Welcome back" :
    mode === "signup" ? "Create your account" :
    mode === "forgot" ? "Reset your password" : "Choose a new password";

  const subtitle =
    mode === "signin" ? "Sign in to keep creating professional scene prompts." :
    mode === "signup" ? "Start with 10 free prompt packages every month." :
    mode === "forgot" ? "We'll send you a reset link." : "Pick something strong — 8+ characters with a number.";

  const card = (
    <div className={compact ? "w-full" : "w-full max-w-[400px]"}>
      <div className={`flex justify-center ${compact ? "mb-4" : "mb-6"}`}>
        <LogoMark className={compact ? "h-10 w-10" : "h-14 w-14"} />
      </div>
      <div className={`rounded-2xl border bg-card shadow-sm ${compact ? "p-5" : "p-6 sm:p-8"}`}>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          {authError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {authError === "banned" ? "This account has been suspended." :
                 authError === "google_state" ? "Sign-in session expired. Try again." :
                 "Google sign-in failed. Please try again."}
              </span>
            </div>
          )}

          {sentNotice ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-[13px]">
                <MailCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>If an account exists for {form.email}, a reset link is on its way.</span>
              </div>
              {devLink && (
                <div className="rounded-lg border bg-muted/50 px-3 py-2.5 text-[12px]">
                  <p className="font-semibold mb-1">Sandbox mode (SMTP not configured):</p>
                  <a href={devLink} className="text-primary font-medium break-all hover:underline">Open reset link</a>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={() => { setMode("signin"); setSentNotice(false); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3.5">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={form.name} onChange={set("name")} placeholder="Alex Director" autoComplete="name" required minLength={2} />
                </div>
              )}
              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@studio.com" autoComplete="email" required />
                </div>
              )}
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-primary hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" value={form.password} onChange={set("password")}
                    placeholder="••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={mode === "signin" ? 1 : 8} />
                </div>
              )}
              {(mode === "signup" || mode === "reset") && (
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Confirm password</Label>
                  <Input id="password2" type="password" value={form.password2} onChange={set("password2")} placeholder="••••••••" autoComplete="new-password" required minLength={8} />
                </div>
              )}

              <Button type="submit" className="w-full h-10 font-semibold" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {(mode === "signin" || mode === "signup") && flags?.googleOAuth && (
                <>
                  <div className="relative py-1 text-center">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <span className="relative bg-card px-3 text-xs text-muted-foreground">or</span>
                  </div>
                  <Button type="button" variant="outline" className="w-full h-10" onClick={() => { window.location.href = "/api/auth/google"; }}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                    Continue with Google
                  </Button>
                </>
              )}
            </form>
          )}

          {!sentNotice && (mode === "signin" || mode === "signup") && (
            <p className="mt-5 text-center text-[13px] text-muted-foreground">
              {mode === "signin" ? (
                <>New to CHAFIKTECH?{" "}
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setMode("signup")}>Create an account</button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setMode("signin")}>Sign in</button>
                </>
              )}
            </p>
          )}
        </div>

        {!compact && (
          <p className="mt-6 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <LogoMark className="h-4 w-4" />
            <span>CHAFIKTECH · AI Video Scene Prompt Generator</span>
          </p>
        )}
    </div>
  );

  if (compact) {
    return <div className="w-full px-5 pb-5 pt-1">{card}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-background relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      {card}
    </div>
  );
}
