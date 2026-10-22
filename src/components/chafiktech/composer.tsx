"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUp, Paperclip, X, Film, Loader2, Clapperboard } from "lucide-react";
import { api, formatBytes, type Language, type Usage } from "@/lib/client";
import { toast } from "sonner";

export type ComposerState = {
  idea: string;
  sceneCount: number;
  languageCode: string;
  video: { id: string; filename: string; sizeBytes: number } | null;
};

const MAX_IDEA = 4000;

export function Composer({
  languages,
  usage,
  value,
  onChange,
  onSubmit,
  busy,
  autoFocus,
  suggestions,
  locked,
  onLockedAction,
}: {
  languages: Language[];
  usage: Usage | null;
  value: ComposerState;
  onChange: (next: ComposerState) => void;
  onSubmit: () => void;
  busy: boolean;
  autoFocus?: boolean;
  suggestions?: string[];
  /** Guest mode: interactions that hit the API trigger the sign-in prompt instead */
  locked?: boolean;
  onLockedAction?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, []);

  useEffect(resize, [value.idea, resize]);
  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  function pickFile(file: File) {
    if (locked) { onLockedAction?.(); return; }
    const maxMb = usage?.maxVideoMb ?? 50;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Reference videos are limited to ${maxMb} MB on your plan.`);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const fd = new FormData();
    fd.append("video", file);
    // Optional client-side duration hint
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) fd.append("duration", String(probe.duration));
      URL.revokeObjectURL(url);
      send();
    };
    probe.onerror = () => { URL.revokeObjectURL(url); send(); };
    probe.src = url;

    function send() {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setUploading(false);
        try {
          const body = JSON.parse(xhr.responseText) as { ok: boolean; data?: { videoId: string; filename: string; sizeBytes: number }; error?: { message: string } };
          if (body.ok && body.data) {
            onChange({ ...value, video: { id: body.data.videoId, filename: body.data.filename, sizeBytes: body.data.sizeBytes } });
            toast.success("Reference video attached.");
          } else {
            toast.error(body.error?.message || "Upload failed.");
          }
        } catch {
          toast.error("Upload failed.");
        }
      };
      xhr.onerror = () => { setUploading(false); toast.error("Upload failed — check your connection."); };
      xhr.send(fd);
    }
  }

  async function removeVideo() {
    const v = value.video;
    if (!v) return;
    onChange({ ...value, video: null });
    api(`/api/upload?id=${encodeURIComponent(v.id)}`, { method: "DELETE" }).catch(() => {});
  }

  const canSend = !busy && !uploading && (value.idea.trim().length >= 12 || !!value.video);

  return (
    <div className="w-full">
      <div className="rounded-2xl border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:border-primary/40">
        <textarea
          ref={taRef}
          value={value.idea}
          maxLength={MAX_IDEA}
          onChange={(e) => onChange({ ...value, idea: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          placeholder="Describe your video idea — story, style, product, mood… the more detail, the better the prompts."
          rows={2}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          aria-label="Video idea"
        />

        {value.video && (
          <div className="mx-3 mb-1 flex items-center gap-2.5 rounded-xl border bg-muted/50 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
              <Film className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{value.video.filename}</p>
              <p className="text-[11px] text-muted-foreground">{formatBytes(value.video.sizeBytes)} · will guide style & motion</p>
            </div>
            <button onClick={removeVideo} className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Remove video">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (locked) { e.target.value = ""; onLockedAction?.(); return; }
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground"
            disabled={uploading || busy}
            onClick={() => { if (locked) { onLockedAction?.(); return; } fileRef.current?.click(); }}
            title={locked ? "Sign in to attach a reference video" : usage ? `Attach reference video (max ${usage.maxVideoMb} MB)` : "Attach reference video"}>
            {uploading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Paperclip className="h-[18px] w-[18px]" />}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" className="h-9 gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground">
                <Clapperboard className="h-4 w-4" />
                {value.sceneCount} scene{value.sceneCount > 1 ? "s" : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scenes to generate</p>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button key={n}
                    onClick={() => onChange({ ...value, sceneCount: n })}
                    className={`h-9 rounded-lg text-[13px] font-semibold transition-colors ${
                      value.sceneCount === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="px-1.5 pt-2 text-[11px] text-muted-foreground">Each scene runs 4–12 seconds.</p>
            </PopoverContent>
          </Popover>

          <Select value={value.languageCode} onValueChange={(v) => onChange({ ...value, languageCode: v })}>
            <SelectTrigger className="h-9 w-auto gap-1.5 rounded-full border-none bg-transparent px-3 text-[13px] font-medium text-muted-foreground shadow-none hover:text-foreground focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="flex items-center gap-2">
                    <span className="text-[13px]">{l.nativeName}</span>
                    {l.nativeName !== l.name && <span className="text-[11px] text-muted-foreground">{l.name}</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {uploadProgress > 0 && uploading && (
            <span className="mr-1 text-[11px] font-medium text-muted-foreground">{uploadProgress}%</span>
          )}
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={!canSend}
            onClick={onSubmit}
            title="Generate"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />}
          </Button>
        </div>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button key={s}
              onClick={() => onChange({ ...value, idea: s })}
              className="rounded-full border bg-card px-3.5 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
