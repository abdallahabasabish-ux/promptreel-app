"use client";

import { Progress } from "@/components/ui/progress";
import { Loader2, Film, PenLine, CheckCircle2, XCircle, Sparkles } from "lucide-react";

const STEPS = [
  { key: "prepare", label: "Preparing prompt package", at: 8 },
  { key: "upload", label: "Uploading reference video to Gemini", at: 20 },
  { key: "analyze", label: "Gemini is analyzing style & motion", at: 40 },
  { key: "write", label: "Writing professional scene prompts", at: 60 },
  { key: "save", label: "Validating and saving scenes", at: 85 },
  { key: "done", label: "Done", at: 100 },
];

export function GenerationProgress({
  progress,
  statusMessage,
  hasVideo,
}: {
  progress: number;
  statusMessage: string;
  hasVideo: boolean;
}) {
  const steps = STEPS.filter((s) => hasVideo || (s.key !== "upload" && s.key !== "analyze"));
  const activeIndex = steps.findIndex((s) => progress < s.at);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Creating your prompt package…</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{statusMessage || "Working…"}</p>
        </div>
        <span className="text-lg font-extrabold text-primary tabular-nums">{Math.min(progress, 99)}%</span>
      </div>
      <Progress value={Math.min(progress, 99)} className="mt-4 h-2" />
      <ul className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const done = progress >= s.at && s.key !== "done";
          const active = i === activeIndex && s.key !== "done";
          return (
            <li key={s.key} className={`flex items-center gap-2.5 text-[13px] ${done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground/70"}`}>
              {done ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : active ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                : <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/25" />}
              <span className="font-medium">{s.label}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Film className="h-3.5 w-3.5" />
        This usually takes 20–60 seconds. Keep this tab open.
      </div>
    </div>
  );
}

export function GenerationFailed({ error, onRetry, onDiscard }: { error: string; onRetry?: () => void; onDiscard?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Generation failed</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>
          {(onRetry || onDiscard) && (
            <div className="mt-3 flex gap-2">
              {onRetry && (
                <button onClick={onRetry} className="rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90">
                  Try again
                </button>
              )}
              {onDiscard && (
                <button onClick={onDiscard} className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold hover:bg-accent">
                  Discard
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { PenLine };
