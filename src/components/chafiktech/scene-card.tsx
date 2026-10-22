"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Camera, ArrowLeftRight, MessageCircle, ImageIcon, Video, Scissors } from "lucide-react";
import { isRtlText, type Scene } from "@/lib/client";
import { toast } from "sonner";

function CopyButton({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        toast.success(label ? `${label} copied` : "Copied");
        setTimeout(() => setCopied(false), 1400);
      }}
      className={`inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${className}`}
      aria-label={label ? `Copy ${label}` : "Copy"}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PromptField({ icon, label, text, rtl }: { icon: React.ReactNode; label: string; text: string; rtl?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {icon}
          {label}
        </span>
        <CopyButton text={text} label={label} />
      </div>
      <div className="prompt-block" dir={rtl || isRtlText(text) ? "rtl" : "ltr"}>{text}</div>
    </div>
  );
}

export function SceneCard({ scene, total, languageName }: { scene: Scene; total: number; languageName: string }) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-xl border bg-card shadow-sm duration-500 [animation-fill-mode:both]"
      style={{ animationDelay: `${Math.min((scene.idx - 1) * 70, 490)}ms` }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-primary px-1.5 text-[12px] font-extrabold text-primary-foreground">
          {scene.idx}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-bold" dir={isRtlText(scene.title) ? "rtl" : "ltr"}>{scene.title}</h3>
        <Badge variant="secondary" className="gap-1 font-semibold">
          <Scissors className="h-3 w-3" />
          {scene.durationSec}s
        </Badge>
        <CopyButton text={sceneToText(scene, total)} label="Scene" className="border-0 bg-transparent hover:bg-accent" />
      </div>
      <div className="space-y-3.5 px-4 py-4">
        <PromptField icon={<ImageIcon className="h-3 w-3" />} label="Image Prompt" text={scene.imagePrompt} />
        <PromptField icon={<Video className="h-3 w-3" />} label="Video Prompt" text={scene.videoPrompt} />
        {scene.dialogue && (
          <PromptField icon={<MessageCircle className="h-3 w-3" />} label={`Dialogue · ${languageName}`} text={scene.dialogue} />
        )}
        {(scene.camera || scene.transition) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-0.5 text-[12px] text-muted-foreground">
            {scene.camera && (
              <span className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground/80">{scene.camera}</span>
              </span>
            )}
            {scene.transition && (
              <span className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground/80">{scene.transition}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function sceneToText(s: Scene, total: number): string {
  return [
    `SCENE ${s.idx}/${total} — ${s.title} (${s.durationSec}s)`,
    ``,
    `IMAGE PROMPT:`,
    s.imagePrompt,
    ``,
    `VIDEO PROMPT:`,
    s.videoPrompt,
    ...(s.dialogue ? [``, `DIALOGUE: ${s.dialogue}`] : []),
    ...(s.camera ? [``, `CAMERA: ${s.camera}`] : []),
    ...(s.transition ? [`TRANSITION: ${s.transition}`] : []),
  ].join("\n");
}

export function projectToMarkdown(p: { title: string; scenes: Scene[]; languageName: string }): string {
  const lines = [
    `# ${p.title}`,
    ``,
    `Generated with CHAFIKTECH · ${p.scenes.length} scenes · Dialogue language: ${p.languageName}`,
    ``,
  ];
  for (const s of p.scenes) {
    lines.push(`## Scene ${s.idx} — ${s.title} (${s.durationSec}s)`, ``, `**Image prompt**`, ``, s.imagePrompt, ``,
      `**Video prompt**`, ``, s.videoPrompt, ``);
    if (s.dialogue) lines.push(`**Dialogue (${p.languageName})**: ${s.dialogue}`, ``);
    if (s.camera) lines.push(`*Camera*: ${s.camera}`, ``);
    if (s.transition) lines.push(`*Transition*: ${s.transition}`, ``);
    lines.push(`---`, ``);
  }
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { CopyButton };
