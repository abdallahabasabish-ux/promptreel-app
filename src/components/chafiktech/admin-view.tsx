"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, LayoutDashboard, Layers, KeyRound, Languages, Users, Settings2,
  Loader2, Plus, Pencil, Trash2, ShieldCheck, FlaskConical, Ban, CheckCircle2, XCircle, Gem,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError, formatDate } from "@/lib/client";

type Tab = "dashboard" | "plans" | "keys" | "languages" | "users" | "settings";

type Stats = {
  totalUsers: number; newUsersThisMonth: number; generationsThisMonth: number;
  generationsTotal: number; succeededThisMonth: number; failedThisMonth: number;
  activeUsersWeek: number; mrrCents: number;
};
type RecentProject = { id: string; title: string; status: string; sceneCount: number; languageName: string; createdAt: string; user: string; hasVideo: boolean };
type AdminPlan = { id: string; name: string; slug: string; description: string; priceCents: number; currency: string; monthlyGenerations: number; maxVideoMb: number; features: string; isActive: boolean; isDefault: boolean; sortOrder: number; _count?: { users: number } };
type AdminKey = { id: string; label: string; masked: string; isActive: boolean; lastStatus: string | null; lastError: string | null; lastCheckedAt: string | null };
type AdminLanguage = { id: string; name: string; nativeName: string; code: string; isActive: boolean; sortOrder: number };
type AdminUser = { id: string; email: string; name: string; role: string; status: string; emailVerified: boolean; plan: { id: string; name: string; slug: string } | null; projects: number; usedThisMonth: number; createdAt: string };
type AdminSettings = { geminiModelFlash: string; geminiModelPro: string; geminiAutoModel: boolean; emailVerificationRequired: boolean; maintenanceMode: boolean; defaultPlanSlug: string; welcomeMessage: string };

export function AdminView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Button variant="ghost" size="sm" className="gap-1.5 font-semibold" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back to studio
          </Button>
          <div className="flex-1" />
          <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="slim-scroll mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
          {([
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "plans", label: "Plans", icon: Layers },
            { id: "keys", label: "Gemini Keys", icon: KeyRound },
            { id: "languages", label: "Prompt Languages", icon: Languages },
            { id: "users", label: "Users", icon: Users },
            { id: "settings", label: "Settings", icon: Settings2 },
          ] as { id: Tab; label: string; icon: typeof LayoutDashboard }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <DashboardTab />}
        {tab === "plans" && <PlansTab />}
        {tab === "keys" && <KeysTab />}
        {tab === "languages" && <LanguagesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ stats: Stats; recent: RecentProject[] }>("/api/admin/stats");
        setStats(res.stats);
        setRecent(res.recent);
      } catch (e) {
        toast.error(e instanceof ApiClientError ? e.message : "Failed to load stats.");
      }
    })();
  }, []);

  if (!stats) return <CenterLoader />;
  const successRate = stats.succeededThisMonth + stats.failedThisMonth > 0
    ? Math.round((stats.succeededThisMonth / (stats.succeededThisMonth + stats.failedThisMonth)) * 100) : 100;

  const cards = [
    { label: "Total users", value: stats.totalUsers, sub: `+${stats.newUsersThisMonth} this month` },
    { label: "Generations this month", value: stats.generationsThisMonth, sub: `${stats.generationsTotal} all-time` },
    { label: "Success rate (30d)", value: `${successRate}%`, sub: `${stats.failedThisMonth} failed` },
    { label: "Active creators (7d)", value: stats.activeUsersWeek, sub: "generated at least once" },
    { label: "MRR", value: `$${(stats.mrrCents / 100).toFixed(0)}`, sub: "from assigned paid plans" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <p className="border-b px-4 py-3 text-[13px] font-bold">Latest generations</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden sm:table-cell">User</TableHead>
              <TableHead>Scenes</TableHead>
              <TableHead className="hidden md:table-cell">Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-56 truncate font-medium">{p.title}{p.hasVideo && <Gem className="ml-1 inline h-3 w-3 text-primary" />}</TableCell>
                <TableCell className="hidden max-w-44 truncate text-muted-foreground sm:table-cell">{p.user}</TableCell>
                <TableCell>{p.sceneCount}</TableCell>
                <TableCell className="hidden md:table-cell">{p.languageName}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(p.createdAt)}</TableCell>
              </TableRow>
            ))}
            {recent.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No generations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded") return <Badge className="gap-1 bg-green-600/15 text-green-700 dark:text-green-400 hover:bg-green-600/20"><CheckCircle2 className="h-3 w-3" /> done</Badge>;
  if (status === "failed") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> failed</Badge>;
  if (status === "running") return <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20"><Loader2 className="h-3 w-3 animate-spin" /> running</Badge>;
  return <Badge variant="secondary">queued</Badge>;
}

/* ---------------- Plans ---------------- */
const emptyPlan = { name: "", slug: "", description: "", priceCents: 0, monthlyGenerations: 10, maxVideoMb: 50, features: "", sortOrder: 10 };

function PlansTab() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<null | { mode: "create" } | { mode: "edit"; plan: AdminPlan }>(null);
  const [form, setForm] = useState<typeof emptyPlan>(emptyPlan);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ plans: AdminPlan[] }>("/api/admin/plans");
      setPlans(res.plans);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to load plans.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function openCreate() { setForm(emptyPlan); setDialog({ mode: "create" }); }
  function openEdit(plan: AdminPlan) {
    let features = plan.features;
    try { features = JSON.parse(plan.features).join("\n"); } catch { /* raw */ }
    setForm({ name: plan.name, slug: plan.slug, description: plan.description, priceCents: plan.priceCents, monthlyGenerations: plan.monthlyGenerations, maxVideoMb: plan.maxVideoMb, features, sortOrder: plan.sortOrder });
    setDialog({ mode: "edit", plan });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, features: form.features.split("\n").map((s) => s.trim()).filter(Boolean) };
      if (dialog?.mode === "create") {
        await api("/api/admin/plans", { method: "POST", json: payload });
        toast.success("Plan created.");
      } else if (dialog?.mode === "edit") {
        await api(`/api/admin/plans/${dialog.plan.id}`, { method: "PATCH", json: payload });
        toast.success("Plan updated.");
      }
      setDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to save plan.");
    } finally { setSaving(false); }
  }

  async function toggleActive(plan: AdminPlan) {
    try {
      await api(`/api/admin/plans/${plan.id}`, { method: "PATCH", json: { isActive: !plan.isActive } });
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  async function remove(plan: AdminPlan) {
    if (!confirm(`Delete plan "${plan.name}"? If users are assigned, it will be deactivated instead.`)) return;
    try {
      const res = await api<{ deleted?: boolean; deactivated?: boolean; message?: string }>(`/api/admin/plans/${plan.id}`, { method: "DELETE" });
      toast.success(res.message || (res.deleted ? "Plan deleted." : "Plan deactivated."));
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  if (loading) return <CenterLoader />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">Plans control monthly generation limits, video size caps and pricing.</p>
        <Button className="gap-1.5 font-bold" onClick={openCreate}><Plus className="h-4 w-4" /> New plan</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          let features: string[] = [];
          try { features = JSON.parse(p.features); } catch { /* ignore */ }
          return (
            <div key={p.id} className={`rounded-xl border bg-card p-4 shadow-sm ${!p.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-[15px] font-extrabold">
                    {p.name}
                    {p.isDefault && <Badge variant="secondary" className="text-[9.5px]">DEFAULT</Badge>}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">/{p.slug}</p>
                </div>
                <Switch checked={p.isActive} onCheckedChange={() => toggleActive(p)} aria-label="Active" />
              </div>
              <p className="mt-2 text-2xl font-extrabold">${(p.priceCents / 100).toFixed(0)}<span className="text-[12px] font-medium text-muted-foreground">/mo</span></p>
              <p className="mt-1 text-[12px] text-muted-foreground">{p.monthlyGenerations === -1 ? "Unlimited" : p.monthlyGenerations} generations · {p.maxVideoMb} MB video</p>
              <ul className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
                {features.slice(0, 3).map((f) => <li key={f} className="truncate">• {f}</li>)}
                {features.length > 3 && <li>+{features.length - 3} more</li>}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-[12px]" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /> Edit</Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(p)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "Create plan" : "Edit plan"}</DialogTitle>
            <DialogDescription>Users on this plan get these limits at their next generation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro" disabled={dialog?.mode === "edit"} /></div>
              <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="pro" disabled={dialog?.mode === "edit"} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="For daily creators" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Price (cents)</Label><Input type="number" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: parseInt(e.target.value || "0", 10) })} /></div>
              <div className="space-y-1"><Label>Gens/mo</Label><Input type="number" value={form.monthlyGenerations} onChange={(e) => setForm({ ...form, monthlyGenerations: parseInt(e.target.value || "0", 10) })} /></div>
              <div className="space-y-1"><Label>Max video MB</Label><Input type="number" value={form.maxVideoMb} onChange={(e) => setForm({ ...form, maxVideoMb: parseInt(e.target.value || "0", 10) })} /></div>
            </div>
            <div className="space-y-1"><Label>Features (one per line)</Label>
              <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                placeholder={"200 prompt packages per month\nReference video up to 300 MB"} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="font-bold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save plan"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Gemini keys ---------------- */
function KeysTab() {
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [envKey, setEnvKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ keys: AdminKey[]; envKey: boolean }>("/api/admin/keys");
      setKeys(res.keys);
      setEnvKey(res.envKey);
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed to load keys."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    try {
      await api("/api/admin/keys", { method: "POST", json: { key: newKey.trim(), label: newLabel.trim() || undefined } });
      toast.success("Key added.");
      setAddOpen(false); setNewKey(""); setNewLabel("");
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed to add key."); }
  }

  async function test(k: AdminKey) {
    setTestingId(k.id);
    try {
      const res = await api<{ ok: boolean; message: string }>("/api/admin/keys/test", { method: "POST", json: { id: k.id } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message, { duration: 5000 });
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Test failed."); }
    finally { setTestingId(null); }
  }

  async function toggle(k: AdminKey) {
    try {
      await api(`/api/admin/keys/${k.id}`, { method: "PATCH", json: { isActive: !k.isActive } });
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  async function remove(k: AdminKey) {
    if (!confirm(`Delete key "${k.label}"?`)) return;
    try {
      await api(`/api/admin/keys/${k.id}`, { method: "DELETE" });
      toast.success("Key deleted.");
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  if (loading) return <CenterLoader />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-lg text-[13px] text-muted-foreground">
          Keys are stored server-side and used with round-robin rotation during generation — they are never exposed to the browser. The AI will not run until at least one working key exists.
        </p>
        <Button className="gap-1.5 font-bold" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add key</Button>
      </div>

      {envKey && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-[13px]">
          <Gem className="h-4 w-4 text-primary" />
          <span>An <strong>GEMINI_API_KEY</strong> is also configured in the server environment and used as a fallback.</span>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Last checked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.label}</TableCell>
                <TableCell className="font-mono text-[12px] text-muted-foreground">{k.masked}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={k.isActive} onCheckedChange={() => toggle(k)} aria-label="Active" />
                    {k.lastStatus === "ok" && <Badge className="bg-green-600/15 text-green-700 dark:text-green-400">valid</Badge>}
                    {k.lastStatus === "invalid" && <Badge variant="destructive">invalid</Badge>}
                  </div>
                  {k.lastError && <p className="mt-1 max-w-52 truncate text-[11px] text-destructive">{k.lastError}</p>}
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{k.lastCheckedAt ? formatDate(k.lastCheckedAt) : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" disabled={testingId === k.id} onClick={() => test(k)}>
                      {testingId === k.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Test
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => remove(k)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {keys.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No keys yet — add a Gemini API key to enable generation.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Gemini API key</DialogTitle>
            <DialogDescription>Get one free from Google AI Studio (aistudio.google.com/apikey).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Label</Label><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Primary key" /></div>
            <div className="space-y-1"><Label>API key</Label><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="AIza…" className="font-mono text-[12px]" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={add} disabled={newKey.trim().length < 20} className="font-bold">Add key</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Languages ---------------- */
function LanguagesTab() {
  const [langs, setLangs] = useState<AdminLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [nativeName, setNativeName] = useState("");
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ languages: AdminLanguage[] }>("/api/admin/languages");
      setLangs(res.languages);
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    setAdding(true);
    try {
      await api("/api/admin/languages", { method: "POST", json: { name, nativeName, code } });
      toast.success("Language added.");
      setName(""); setNativeName(""); setCode("");
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
    finally { setAdding(false); }
  }

  async function toggle(l: AdminLanguage) {
    try {
      await api(`/api/admin/languages/${l.id}`, { method: "PATCH", json: { isActive: !l.isActive } });
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  async function remove(l: AdminLanguage) {
    if (!confirm(`Delete "${l.name}" from prompt languages?`)) return;
    try {
      const res = await api<{ deleted?: boolean; deactivated?: boolean; message?: string }>(`/api/admin/languages/${l.id}`, { method: "DELETE" });
      toast.success(res.message || "Removed.");
      await load();
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  if (loading) return <CenterLoader />;
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[13px] text-muted-foreground">
        These are the <strong>output prompt languages</strong> users can pick when generating. The site UI is English-only; these languages apply to the generated image/video prompts and dialogue.
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (English)" />
        <Input value={nativeName} onChange={(e) => setNativeName(e.target.value)} placeholder="Native name (العربية)" />
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (ar)" />
        <Button onClick={add} disabled={adding || name.length < 2 || code.length < 2} className="gap-1.5 font-bold">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </Button>
      </div>
      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Language</TableHead><TableHead>Native</TableHead><TableHead>Code</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {langs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell>{l.nativeName}</TableCell>
                <TableCell className="font-mono text-[12px]">{l.code}</TableCell>
                <TableCell><Switch checked={l.isActive} onCheckedChange={() => toggle(l)} aria-label="Active" /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => remove(l)}><Trash2 className="h-3 w-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const res = await api<{ users: AdminUser[]; plans: { id: string; name: string; slug: string }[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`);
      setUsers(res.users);
      setPlans(res.plans);
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function patch(u: AdminUser, body: Record<string, unknown>) {
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", json: body });
      toast.success(`${u.email} updated.`);
      await load(q);
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Permanently delete ${u.email} and all their data?`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      toast.success("User deleted.");
      await load(q);
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed."); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name…"
          onKeyDown={(e) => { if (e.key === "Enter") void load(q); }} className="max-w-xs" />
        <Button variant="outline" className="font-semibold" onClick={() => void load(q)}>Search</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="hidden md:table-cell">Used / mo</TableHead>
              <TableHead className="hidden sm:table-cell">Projects</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-medium">{u.name}{u.role === "admin" && <ShieldCheck className="ml-1 inline h-3.5 w-3.5 text-primary" />}</p>
                  <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  <Select value={u.plan?.id ?? "none"} onValueChange={(v) => patch(u, { planId: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-8 w-36 text-[12.5px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No plan</SelectItem>
                      {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {u.plan?.slug === "none" || !u.plan ? "—" : (
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{u.usedThisMonth}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell tabular-nums">{u.projects}</TableCell>
                <TableCell>
                  <button className="text-[12.5px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => patch(u, { role: u.role === "admin" ? "user" : "admin" })}>
                    {u.role}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant={u.status === "active" ? "secondary" : "destructive"}>{u.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => patch(u, { status: u.status === "active" ? "banned" : "active" })}>
                      {u.status === "active" ? <><Ban className="h-3 w-3" /> Ban</> : <><CheckCircle2 className="h-3 w-3" /> Unban</>}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => remove(u)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No users match your search.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {loading && <CenterLoader />}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [plans, setPlans] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ settings: AdminSettings; flags: Record<string, boolean>; plans: { id: string; name: string; slug: string }[] }>("/api/admin/settings");
        setSettings(res.settings);
        setFlags(res.flags);
        setPlans(res.plans);
      } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed to load settings."); }
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await api("/api/admin/settings", { method: "PUT", json: settings });
      toast.success("Settings saved.");
    } catch (e) { toast.error(e instanceof ApiClientError ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  }

  if (!settings) return <CenterLoader />;
  return (
    <div className="max-w-2xl space-y-6">
      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-[14px] font-extrabold"><Gem className="h-4 w-4 text-primary" /> Gemini models</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Flash model (fast & cheap)</Label>
            <Input value={settings.geminiModelFlash} onChange={(e) => setSettings({ ...settings, geminiModelFlash: e.target.value })} className="font-mono text-[12.5px]" />
          </div>
          <div className="space-y-1">
            <Label>Pro model (deep analysis)</Label>
            <Input value={settings.geminiModelPro} onChange={(e) => setSettings({ ...settings, geminiModelPro: e.target.value })} className="font-mono text-[12.5px]" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-3">
          <div>
            <p className="text-[13px] font-bold">Smart auto-selection</p>
            <p className="text-[11.5px] text-muted-foreground">Pro is used automatically for reference videos and 6+ scene runs.</p>
          </div>
          <Switch checked={settings.geminiAutoModel} onCheckedChange={(v) => setSettings({ ...settings, geminiAutoModel: v })} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-[14px] font-extrabold">Platform</h3>
        <div className="space-y-1">
          <Label>Welcome headline (empty state)</Label>
          <Input value={settings.welcomeMessage} onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Default plan for new signups</Label>
          <Select value={settings.defaultPlanSlug} onValueChange={(v) => setSettings({ ...settings, defaultPlanSlug: v })}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {plans.map((p) => <SelectItem key={p.id} value={p.slug}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ToggleRow label="Require email verification" hint="New accounts must verify before generating (needs SMTP in production)."
          checked={settings.emailVerificationRequired} onChange={(v) => setSettings({ ...settings, emailVerificationRequired: v })} />
        <ToggleRow label="Maintenance mode" hint="Blocks new generations for non-admin users."
          checked={settings.maintenanceMode} onChange={(v) => setSettings({ ...settings, maintenanceMode: v })} />
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-[14px] font-extrabold">Integrations</h3>
        <IntegrationRow name="Google OAuth (Sign in with Google)" configured={flags.googleOAuth} hint="Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars." />
        <IntegrationRow name="Stripe payments" configured={flags.stripe} hint="Set STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET for webhooks)." />
        <IntegrationRow name="SMTP email delivery" configured={flags.smtp} hint="Set SMTP_HOST + SMTP_USER (+ SMTP_PASS) to send verification/reset emails." />
        <IntegrationRow name="Gemini environment key" configured={flags.geminiEnv} hint="Optional GEMINI_API_KEY env fallback." />
      </section>

      <Button onClick={save} disabled={saving} className="w-40 font-bold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
      </Button>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-3">
      <div>
        <p className="text-[13px] font-bold">{label}</p>
        <p className="text-[11.5px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function IntegrationRow({ name, configured, hint }: { name: string; configured?: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-3">
      <div>
        <p className="text-[13px] font-bold">{name}</p>
        <p className="text-[11.5px] text-muted-foreground">{hint}</p>
      </div>
      {configured
        ? <Badge className="bg-green-600/15 text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3" /> configured</Badge>
        : <Badge variant="secondary">not configured</Badge>}
    </div>
  );
}

function CenterLoader() {
  return <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;
}
