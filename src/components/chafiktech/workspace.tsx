"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, Search, PanelLeftClose, PanelLeft, Menu, Sun, Moon, Zap,
  Settings, CreditCard, LogOut, ShieldCheck, Trash2, Clapperboard,
  Film, Copy, FileDown, Share2, Shuffle, Check, Link2, Sparkles, Gem, UserRound, Info, X,
} from "lucide-react";
import { toast } from "sonner";
import { Logo, LogoMark } from "@/components/chafiktech/logo";
import { Composer, type ComposerState } from "@/components/chafiktech/composer";
import { GenerationProgress, GenerationFailed } from "@/components/chafiktech/generation-progress";
import { SceneCard, sceneToText, projectToMarkdown, downloadFile, CopyButton } from "@/components/chafiktech/scene-card";
import {
  api, ApiClientError, formatBytes, groupByDate, isRtlText,
  type AppUser, type Usage, type Flags, type Language, type Plan, type ProjectSummary, type ProjectDetail,
} from "@/lib/client";
import type { SettingsDialog } from "@/components/chafiktech/settings-dialog";

const SUGGESTIONS = [
  "Product ad for a luxury perfume brand",
  "Cinematic short film trailer — desert thriller",
  "UGC-style skincare review with natural lighting",
  "Travel reel: hidden gems of Morocco at golden hour",
];

export function Workspace({
  user,
  usage,
  flags,
  settings,
  languages,
  plans,
  refreshBoot,
  onOpenPricing,
  onSignOut,
  onRequireSignIn,
}: {
  user: AppUser | null; // null = guest preview mode
  usage: Usage;
  flags: Flags;
  settings: { welcomeMessage: string };
  languages: Language[];
  plans: Plan[];
  refreshBoot: () => Promise<void>;
  onOpenPricing: () => void;
  onSignOut: () => void;
  onRequireSignIn: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const guest = !user;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectSummary | null>(null);
  const [signInBarOpen, setSignInBarOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({
    idea: "",
    sceneCount: user?.defaultSceneCount || 6,
    languageCode: (user ? languages.find((l) => l.code === user.defaultLanguageCode)?.code : undefined) || languages[0]?.code || "en",
    video: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingSubmitRef = useRef(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (user) setSignInBarOpen(false); }, [user]);
  // Privacy: when the session ends, drop any open thread so a guest never sees previous results
  useEffect(() => {
    if (!user) { setActiveId(null); setDetail(null); setMobileNav(false); }
  }, [user]);

  /** Guest tried to use the tool — surface the light top notification (no modal) */
  const handleLockedAction = useCallback(() => setSignInBarOpen(true), []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api<{ projects: ProjectSummary[] }>("/api/projects");
      setProjects(res.projects);
      return res.projects;
    } catch {
      return [];
    }
  }, []);

  const loadDetail = useCallback(async (id: string, quiet = false) => {
    try {
      const res = await api<{ project: ProjectDetail }>(`/api/projects/${id}`);
      setDetail(res.project);
      return res.project;
    } catch (e) {
      if (!quiet) toast.error(e instanceof ApiClientError ? e.message : "Failed to load generation.");
      return null;
    }
  }, []);

  useEffect(() => { if (user) void loadProjects(); }, [user, loadProjects]);

  // Poll while a project is running
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (detail && (detail.status === "queued" || detail.status === "running")) {
      pollRef.current = setInterval(async () => {
        const p = await loadDetail(detail.id, true);
        if (p && p.status !== "queued" && p.status !== "running") {
          if (p.status === "succeeded") { toast.success("Your prompt package is ready!"); void loadProjects(); void refreshBoot(); }
        }
      }, 2500);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [detail?.id, detail?.status, loadDetail, loadProjects, refreshBoot]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [detail?.status, detail?.scenes?.length]);

  const createGeneration = useCallback(async () => {
    if (!user) {
      // Guest tried to use the tool — show the top sign-in bar, keep their idea for after sign-in
      if (composer.idea.trim().length >= 12 || composer.video) pendingSubmitRef.current = true;
      setSignInBarOpen(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<{ projectId: string }>("/api/projects", {
        method: "POST",
        json: { idea: composer.idea.trim(), sceneCount: composer.sceneCount, languageCode: composer.languageCode, videoId: composer.video?.id },
      });
      setComposer((c) => ({ ...c, idea: "", video: null }));
      setActiveId(res.projectId);
      await loadDetail(res.projectId);
      await loadProjects();
      void refreshBoot();
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === "quota_exceeded") { onOpenPricing(); }
        toast.error(e.message, { duration: 6000 });
      } else {
        toast.error("Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }, [user, busy, composer, onRequireSignIn, loadDetail, loadProjects, refreshBoot, onOpenPricing]);

  // Auto-start the pending generation right after a guest finishes signing in
  useEffect(() => {
    if (!user || !pendingSubmitRef.current || busy) return;
    pendingSubmitRef.current = false;
    void createGeneration();
  }, [user, busy, createGeneration]);

  async function retryGeneration() {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await api<{ projectId: string }>("/api/projects", {
        method: "POST",
        json: { idea: detail.idea, sceneCount: detail.sceneCount, languageCode: detail.languageCode, videoId: detail.video?.filename ? undefined : undefined },
      });
      setActiveId(res.projectId);
      await loadDetail(res.projectId);
      await loadProjects();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare() {
    if (!detail) return;
    setShareLoading(true);
    try {
      const res = await api<{ shareEnabled: boolean; shareToken: string | null }>(`/api/projects/${detail.id}/share`, {
        method: "POST",
        json: { enabled: !detail.shareEnabled },
      });
      setDetail({ ...detail, shareEnabled: res.shareEnabled, shareToken: res.shareToken });
      if (res.shareEnabled && res.shareToken) {
        const url = `${window.location.origin}/?share=${res.shareToken}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Share link copied to clipboard!", { duration: 4000 });
      } else {
        toast.success("Sharing disabled.");
      }
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to update sharing.");
    } finally {
      setShareLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await api(`/api/projects/${deleteConfirm.id}`, { method: "DELETE" });
      toast.success("Generation deleted.");
      setDeleteConfirm(null);
      if (activeId === deleteConfirm.id) { setActiveId(null); setDetail(null); }
      await loadProjects();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Delete failed.");
    }
  }

  function copyAll() {
    if (!detail || detail.scenes.length === 0) return;
    const text = detail.scenes.map((s) => sceneToText(s, detail.scenes.length)).join("\n\n" + "─".repeat(40) + "\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      toast.success("All scenes copied!");
      setTimeout(() => setCopiedAll(false), 1600);
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects;
  }, [projects, search]);
  const groups = groupByDate(filtered);

  const usagePct = usage.limit === -1 ? 0 : Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100));
  const isFreePlan = usage.planSlug === "free" || usage.planSlug === "none";
  const quotaExceeded = usage.limit !== -1 && usage.used >= usage.limit;

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-3.5 pt-4">
        <Logo />
        <Button variant="ghost" size="icon" className="hidden lg:inline-flex h-8 w-8 text-muted-foreground" onClick={() => setSidebarOpen(false)} title="Collapse sidebar">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pt-4">
        <Button
          onClick={() => { setActiveId(null); setDetail(null); setMobileNav(false); }}
          className="w-full justify-start gap-2 h-10 rounded-xl border bg-card font-semibold shadow-sm hover:border-primary/40 hover:bg-accent"
          variant="outline"
        >
          <Plus className="h-4 w-4 text-primary" strokeWidth={2.5} />
          New generation
        </Button>
      </div>

      <div className="px-3 pt-3">
        {guest ? (
          <div className="px-1 pt-4 text-center">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Sign in to save your generations and revisit them anytime.
            </p>
            <Button size="sm" onClick={onRequireSignIn}
              className="mt-3 h-8 rounded-lg px-5 text-[12.5px] font-bold">
              Sign in
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search generations"
              className="h-9 rounded-xl bg-muted/60 border-none pl-8 text-[13px] focus-visible:ring-1" />
          </div>
        )}
      </div>

      {!guest && (
        <nav className="slim-scroll mt-3 flex-1 overflow-y-auto px-3 pb-3" aria-label="Generation history">
          {groups.length === 0 && (
          <p className="px-2 pt-6 text-center text-[12.5px] leading-relaxed text-muted-foreground">
            No generations yet.<br />Describe an idea to get started.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-2">
            <p className="px-2 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{g.label}</p>
            {g.items.map((p) => (
              <button key={p.id}
                onClick={() => { setActiveId(p.id); void loadDetail(p.id); setMobileNav(false); }}
                className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13.5px] transition-colors ${
                  activeId === p.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "hover:bg-sidebar-accent/60"
                }`}>
                {p.status === "succeeded" ? <Clapperboard className="h-4 w-4 shrink-0 text-primary/80" />
                  : p.status === "failed" ? <XCircleIcon />
                  : <LoaderIcon />}
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDeleteConfirm(p); } }}
                  className="hidden shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                  aria-label={`Delete ${p.title}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        ))}
        </nav>
      )}

      <div className="mt-auto border-t p-3">
        {guest ? (
          <>
            <button onClick={onRequireSignIn}
              className="mb-3 w-full rounded-xl bg-gradient-to-br from-primary to-primary/80 p-3 text-left text-primary-foreground shadow-sm transition-transform hover:scale-[1.01]">
              <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold uppercase tracking-wide">
                <Sparkles className="h-3.5 w-3.5" /> Sign in to start
              </span>
              <span className="mt-0.5 block text-[11.5px] opacity-90">10 free prompt packages every month</span>
            </button>
            <button onClick={onRequireSignIn} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-sidebar-accent/60">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">Guest</span>
                <span className="block truncate text-[11px] text-muted-foreground">Sign in or create an account</span>
              </span>
            </button>
          </>
        ) : (
          <>
        {isFreePlan && (
          <button onClick={onOpenPricing}
            className="mb-3 w-full rounded-xl bg-gradient-to-br from-primary to-primary/80 p-3 text-left text-primary-foreground shadow-sm transition-transform hover:scale-[1.01]">
            <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold uppercase tracking-wide">
              <Zap className="h-3.5 w-3.5" /> Upgrade to Pro
            </span>
            <span className="mt-0.5 block text-[11.5px] opacity-90">200 generations/mo + bigger videos</span>
          </button>
        )}
        <div className="mb-2 px-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium">{usage.planName} plan</span>
            <span>{usage.limit === -1 ? `${usage.used} used · unlimited` : `${usage.used} / ${usage.limit} this month`}</span>
          </div>
          {usage.limit !== -1 && (
            <Progress value={usagePct} className={`mt-1.5 h-1.5 ${quotaExceeded ? "[&>div]:bg-destructive" : ""}`} />
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-sidebar-accent/60">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-extrabold text-primary">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{user.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">{usage.planName} plan{usage.periodEnd ? ` · renews ${new Date(usage.periodEnd).toLocaleDateString()}` : ""}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}><Settings className="h-4 w-4" /> Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenPricing}><CreditCard className="h-4 w-4" /> Plans & pricing</DropdownMenuItem>
            {user.role === "admin" && (
              <DropdownMenuItem onClick={() => { window.location.hash = "#admin"; }}><ShieldCheck className="h-4 w-4" /> Admin panel</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );

  const showThread = !!detail;
  const running = detail?.status === "queued" || detail?.status === "running";

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      {sidebarOpen && <aside className="hidden lg:block w-[264px] shrink-0 border-r">{sidebar}</aside>}
      {!sidebarOpen && (
        <div className="hidden lg:flex w-[52px] shrink-0 flex-col items-center gap-3 border-r pt-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)} title="Open sidebar">
            <PanelLeft className="h-4 w-4" />
          </Button>
          <LogoMark className="h-8 w-8" />
        </div>
      )}

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r shadow-xl">{sidebar}</aside>
        </div>
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
          {detail ? (
            <h1 className="min-w-0 flex-1 truncate text-[14px] font-bold" dir={isRtlText(detail.title) ? "rtl" : "ltr"}>{detail.title}</h1>
          ) : (
            <div className="flex-1" />
          )}
          {flags.maintenanceMode && (
            <span className="hidden rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive sm:block">MAINTENANCE MODE</span>
          )}
          {guest ? (
            <Button size="sm" onClick={onRequireSignIn}
              className="h-8 rounded-full px-4 text-[12.5px] font-bold">
              Sign in
            </Button>
          ) : (
            <span className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold text-muted-foreground sm:flex">
              <Gem className="h-3 w-3 text-primary" />
              {usage.limit === -1 ? `${usage.planName} · ${usage.used} used` : `${usage.used}/${usage.limit} ${usage.planName}`}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title={resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}>
            {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>

        {/* Guest sign-in nudge — light notification bar, requested instead of a modal */}
        {guest && signInBarOpen && (
          <div
            role="status"
            className="animate-in slide-in-from-top-2 fade-in duration-300 shrink-0 border-b border-primary/25 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent"
          >
            <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3 py-2.5 sm:px-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="min-w-0 flex-1 text-[12.5px] leading-snug">
                <span className="font-extrabold">Sign in to start generating.</span>{" "}
                <span className="text-muted-foreground">It’s free — your idea is kept and runs right after you sign in.</span>
              </p>
              <Button size="sm" onClick={onRequireSignIn} className="h-7 shrink-0 rounded-full px-3.5 text-[12px] font-bold">
                Sign in
              </Button>
              <button
                onClick={() => setSignInBarOpen(false)}
                aria-label="Dismiss sign-in reminder"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="slim-scroll flex-1 overflow-y-auto">
          {!showThread ? (
            /* Empty state — chat.z.ai style centered greeting */
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 pb-16">
              <div className="mb-6 flex animate-in fade-in slide-in-from-bottom-3 flex-col items-center gap-3 text-center duration-500">
                <LogoMark className="h-14 w-14 drop-shadow-sm" />
                <h1 className="text-[26px] font-extrabold tracking-tight sm:text-3xl">{settings.welcomeMessage || "What do you want to create today?"}</h1>
                <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
                  Describe your video idea — CHAFIKTECH turns it into professional scene-by-scene image & video prompts, with dialogue in your chosen language.
                </p>
              </div>
              <Composer
                languages={languages}
                usage={guest ? null : usage}
                value={composer}
                onChange={setComposer}
                onSubmit={createGeneration}
                busy={busy}
                suggestions={SUGGESTIONS}
                locked={guest}
                onLockedAction={handleLockedAction}
              />
              {guest && (
                <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-center text-[12.5px] text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    You are previewing the tool as a guest —{" "}
                    <button onClick={onRequireSignIn} className="font-bold text-primary hover:underline">sign in</button>{" "}
                    to generate your first prompt package.
                  </span>
                </p>
              )}
              {quotaExceeded && (
                <p className="mt-4 rounded-full bg-destructive/10 px-4 py-1.5 text-[12.5px] font-semibold text-destructive">
                  Monthly quota used up — <button className="underline" onClick={onOpenPricing}>upgrade</button> to keep creating.
                </p>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl animate-in fade-in px-4 py-6 duration-300 sm:py-8">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                  {detail.idea && <p className="whitespace-pre-wrap text-[14px] leading-relaxed" dir={isRtlText(detail.idea) ? "rtl" : "ltr"}>{detail.idea}</p>}
                  {detail.video && (
                    <div className={`flex items-center gap-2 text-[12px] ${detail.idea ? "mt-2 border-t border-primary-foreground/20 pt-2" : ""}`}>
                      <Film className="h-3.5 w-3.5" />
                      <span className="truncate font-medium">{detail.video.filename}</span>
                      <span className="opacity-70">{formatBytes(detail.video.sizeBytes)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px] opacity-80">
                    <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">{detail.sceneCount} scenes</span>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">{detail.languageName}</span>
                  </div>
                </div>
              </div>

              {/* Assistant output */}
              <div className="mt-5 space-y-4">
                {running && <GenerationProgress progress={detail.progress} statusMessage={detail.statusMessage} hasVideo={detail.hasVideo} />}
                {detail.status === "failed" && detail.error && (
                  <GenerationFailed error={detail.error} onRetry={usage.limit === -1 || usage.used < usage.limit ? retryGeneration : undefined} onDiscard={undefined} />
                )}
                {detail.status === "succeeded" && detail.scenes.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {detail.scenes.length} scenes · {detail.scenes.reduce((a, s) => a + s.durationSec, 0)}s total
                        {detail.modelUsed && <> · {detail.modelUsed}</>}
                      </span>
                    </div>
                    {detail.scenes.map((s) => (
                      <SceneCard key={s.idx} scene={s} total={detail.scenes.length} languageName={detail.languageName} />
                    ))}

                    {/* Thread actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold" onClick={copyAll}>
                        {copiedAll ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy all
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold"
                        onClick={() => downloadFile(`${slugify(detail.title)}.json`, JSON.stringify({ title: detail.title, scenes: detail.scenes }, null, 2), "application/json")}>
                        <FileDown className="h-3.5 w-3.5" /> JSON
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold"
                        onClick={() => downloadFile(`${slugify(detail.title)}.md`, projectToMarkdown(detail), "text/markdown")}>
                        <FileDown className="h-3.5 w-3.5" /> Markdown
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold" disabled={shareLoading} onClick={toggleShare}>
                        {detail.shareEnabled ? <Link2 className="h-3.5 w-3.5 text-green-600" /> : <Share2 className="h-3.5 w-3.5" />}
                        {detail.shareEnabled ? "Shared" : "Share"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold"
                        onClick={() => { setActiveId(null); setDetail(null); setComposer((c) => ({ ...c, idea: detail.idea })); }}>
                        <Shuffle className="h-3.5 w-3.5" /> Remix
                      </Button>
                    </div>
                    {detail.shareEnabled && detail.shareToken && (
                      <p className="break-all rounded-lg border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                        Anyone with this link can view:{" "}
                        <a className="font-semibold text-primary hover:underline" href={`/?share=${detail.shareToken}`} target="_blank" rel="noreferrer">
                          {`${typeof window !== "undefined" ? window.location.origin : ""}/?share=${detail.shareToken}`}
                        </a>
                      </p>
                    )}
                  </>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          )}
        </div>

        {/* Composer pinned to bottom in thread view */}
        {showThread && (
          <div className="shrink-0 border-t bg-background/80 px-4 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="mx-auto max-w-3xl">
              <Composer languages={languages} usage={guest ? null : usage} value={composer} onChange={setComposer} onSubmit={createGeneration} busy={busy} locked={guest} onLockedAction={handleLockedAction} />
            </div>
          </div>
        )}
      </main>

      {user && (
        <SettingsDialogBridge open={settingsOpen} onOpenChange={setSettingsOpen} user={user} languages={languages} refreshBoot={refreshBoot} onSignOut={onSignOut} usage={usage} flags={flags} onOpenPricing={onOpenPricing} />
      )}

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this generation?</DialogTitle>
            <DialogDescription>“{deleteConfirm?.title}” and its scenes will be permanently removed.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function XCircleIcon() {
  return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-destructive/50" aria-hidden />;
}
function LoaderIcon() {
  return <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-primary/40" aria-hidden />;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "chafiktech";
}

/* Lazily-rendered settings dialog (imported lazily to keep the workspace lean) */
function SettingsDialogBridge(props: {
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
  const [Comp, setComp] = useState<typeof SettingsDialog | null>(null);
  useEffect(() => {
    if (props.open && !Comp) {
      void import("@/components/chafiktech/settings-dialog").then((m) => setComp(() => m.SettingsDialog));
    }
  }, [props.open, Comp]);
  if (!Comp) return null;
  return <Comp {...props} />;
}
