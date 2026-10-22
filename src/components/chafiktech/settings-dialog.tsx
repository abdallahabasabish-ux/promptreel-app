"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Monitor, Sun, Moon, Loader2, Trash2, LogOut, Gem, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError, type AppUser, type Language, type Usage, type Flags } from "@/lib/client";

type Tab = "general" | "account" | "billing";

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  languages,
  refreshBoot,
  onSignOut,
  usage,
  flags,
  onOpenPricing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: AppUser;
  languages: Language[];
  refreshBoot: () => Promise<void>;
  onSignOut: () => void;
  usage: Usage;
  flags: Flags;
  onOpenPricing: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState(user.name);
  const [sceneCount, setSceneCount] = useState(String(user.defaultSceneCount || 6));
  const [langCode, setLangCode] = useState(user.defaultLanguageCode);
  const [saving, setSaving] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) { setName(user.name); setSceneCount(String(user.defaultSceneCount || 6)); setLangCode(user.defaultLanguageCode); setConfirmDelete(false); setDeletePassword(""); }
  }, [open, user]);

  async function saveGeneral() {
    setSaving(true);
    try {
      await api("/api/user/settings", {
        method: "PATCH",
        json: { name, defaultSceneCount: parseInt(sceneCount, 10), defaultLanguageCode: langCode, theme: theme ?? "system" },
      });
      toast.success("Settings saved.");
      await refreshBoot();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const themeOptions = [
    { value: "system", label: "System", icon: Monitor, hint: "Follows your device" },
    { value: "light", label: "Light", icon: Sun, hint: "Bright & warm" },
    { value: "dark", label: "Dark", icon: Moon, hint: "Deep cocoa" },
  ];

  const usagePct = usage.limit === -1 ? 0 : Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">Manage your CHAFIKTECH preferences</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh]">
          <div className="w-40 shrink-0 border-r bg-muted/30 p-2">
            {([
              { id: "general", label: "General" },
              { id: "account", label: "Account" },
              { id: "billing", label: "Billing" },
            ] as { id: Tab; label: string }[]).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
                  tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="slim-scroll min-w-0 flex-1 overflow-y-auto p-5">
            {tab === "general" && (
              <div className="space-y-5">
                <div>
                  <Label className="mb-2">Appearance</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {themeOptions.map((opt) => (
                      <button key={opt.value} onClick={() => setTheme(opt.value)}
                        className={`rounded-xl border p-3 text-center transition-colors ${
                          (theme ?? "system") === opt.value ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                        }`}>
                        <opt.icon className="mx-auto h-5 w-5" />
                        <span className="mt-1.5 block text-[12.5px] font-bold">{opt.label}</span>
                        <span className="block text-[10.5px] text-muted-foreground">{opt.hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">“System” follows your device light/dark preference automatically.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="set-scene">Default scenes per generation</Label>
                  <Select value={sceneCount} onValueChange={setSceneCount}>
                    <SelectTrigger id="set-scene" className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <SelectItem key={n} value={String(n)}>{n} scenes</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="set-lang">Default prompt language</Label>
                  <Select value={langCode} onValueChange={setLangCode}>
                    <SelectTrigger id="set-lang" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {languages.map((l) => (
                        <SelectItem key={l.code} value={l.code}>{l.nativeName} · {l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={saveGeneral} disabled={saving} className="w-32 font-semibold">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                </Button>
              </div>
            )}

            {tab === "account" && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="set-name">Full name</Label>
                  <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={user.email} disabled />
                  <p className="text-[11.5px] text-muted-foreground">
                    {user.emailVerified ? "Verified" : "Not verified yet"} · Member since {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveGeneral} disabled={saving} className="font-semibold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button variant="outline" onClick={onSignOut} className="gap-1.5 font-semibold">
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>

                <div className="rounded-xl border border-destructive/30 p-4">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Danger zone
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Deleting your account removes all generations, videos and data permanently.
                  </p>
                  {!confirmDelete ? (
                    <Button variant="destructive" size="sm" className="mt-3 gap-1.5" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete my account
                    </Button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {user.emailVerified && false && null}
                      <Input type="password" placeholder="Confirm your current password" value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)} />
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" disabled={deleting}
                          onClick={async () => {
                            setDeleting(true);
                            try {
                              await api("/api/user/account", { method: "DELETE", json: { password: deletePassword } });
                              toast.success("Account deleted.");
                              window.location.href = "/";
                            } catch (err) {
                              toast.error(err instanceof ApiClientError ? err.message : "Failed.");
                            } finally { setDeleting(false); }
                          }}>
                          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm delete"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "billing" && (
              <div className="space-y-5">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[14px] font-extrabold">
                      <Gem className="h-4 w-4 text-primary" /> {usage.planName} plan
                    </span>
                    {usage.periodEnd && (
                      <span className="text-[11.5px] text-muted-foreground">
                        {new Date(usage.periodEnd) > new Date() ? "Active" : "Expired"} · {new Date(usage.periodEnd).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>Generations this month</span>
                    <span className="font-bold text-foreground">{usage.limit === -1 ? `${usage.used} (unlimited)` : `${usage.used} / ${usage.limit}`}</span>
                  </div>
                  {usage.limit !== -1 && <Progress value={usagePct} className="mt-1.5 h-2" />}
                  <p className="mt-2 text-[11.5px] text-muted-foreground">Reference videos up to {usage.maxVideoMb} MB</p>
                </div>
                <Button onClick={onOpenPricing} className="gap-1.5 font-semibold">
                  <CreditCard className="h-4 w-4" /> View plans & upgrade
                </Button>
                {!flags.stripe && (
                  <p className="rounded-lg border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                    Card payments activate as soon as Stripe keys are configured by the administrator. Until then, plans can be assigned manually from the admin panel.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
