"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Copy, Check, Film } from "lucide-react";
import { LogoMark } from "@/components/chafiktech/logo";
import { SceneCard } from "@/components/chafiktech/scene-card";
import { api, type ProjectDetail } from "@/lib/client";

export function ShareView({ token, onHome }: { token: string; onHome: () => void }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ project: ProjectDetail }>(`/api/share/${encodeURIComponent(token)}`);
        setProject(res.project);
      } catch {
        setError("This share link is invalid, disabled, or has expired.");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
          <LogoMark className="h-8 w-8" />
          <span className="text-[15px] font-extrabold">CHAFIK<span className="text-primary">TECH</span></span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Shared</span>
          <div className="flex-1" />
          <Button size="sm" className="font-bold" onClick={onHome}>Create your own</Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 text-center">
            <p className="font-bold">{error}</p>
            <Button className="mt-4" onClick={onHome}>Go to CHAFIKTECH</Button>
          </div>
        )}
        {!error && !project && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading shared generation…
          </div>
        )}
        {project && (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-extrabold tracking-tight">{project.title}</h1>
              <p className="mt-1.5 flex items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {project.scenes.length} scenes · dialogue in {project.languageName} · made with CHAFIKTECH
              </p>
            </div>
            <div className="space-y-4">
              {project.scenes.map((s) => (
                <SceneCard key={s.idx} scene={s} total={project.scenes.length} languageName={project.languageName} />
              ))}
            </div>
            <div className="mt-8 rounded-2xl border bg-card p-6 text-center shadow-sm">
              <Film className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-3 text-lg font-extrabold">Turn your idea into professional scene prompts</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-muted-foreground">
                CHAFIKTECH generates image & video prompts scene by scene — with reference-video style guidance.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button className="font-bold" onClick={onHome}>Start free</Button>
                <Button variant="outline" className="gap-1.5 font-semibold" onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} Copy link
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
