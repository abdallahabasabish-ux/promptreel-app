"use client";

import { useEffect, useState } from "react";

const PROBE_KEY = "chafiktech:logo-probe";
const PROBE_TTL = 24 * 60 * 60 * 1000; // re-probe daily so a newly added logo is picked up

/**
 * CHAFIKTECH brand mark — film reel, drawn from the Chafik Tech identity
 * (#ef780d orange on #270c00 cocoa). Replaceable: drop the real logo file
 * at /public/brand-logo.png and it takes over automatically.
 *
 * The probe result is cached in localStorage for 24h to avoid a 404
 * request on every page load when the custom logo is not present yet.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const [useCustom, setUseCustom] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      const cached = JSON.parse(localStorage.getItem(PROBE_KEY) || "null") as { found: boolean; ts: number } | null;
      if (cached && Date.now() - cached.ts < PROBE_TTL) {
        if (cached.found) queueMicrotask(() => setUseCustom(true));
        return;
      }
    } catch {
      // corrupted cache entry — fall through to a fresh probe
    }
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setUseCustom(true);
      try { localStorage.setItem(PROBE_KEY, JSON.stringify({ found: true, ts: Date.now() })); } catch {}
    };
    img.onerror = () => {
      if (!alive) return;
      try { localStorage.setItem(PROBE_KEY, JSON.stringify({ found: false, ts: Date.now() })); } catch {}
    };
    img.src = "/brand-logo.png";
    return () => { alive = false; };
  }, []);

  if (useCustom) {
    return <img src="/brand-logo.png" alt="CHAFIKTECH" className={`${className} rounded-lg object-contain`} />;
  }
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="CHAFIKTECH">
      <rect width="64" height="64" rx="14" fill="#270c00" />
      <circle cx="32" cy="32" r="20" fill="#ef780d" />
      <circle cx="32" cy="21.4" r="4.1" fill="#270c00" />
      <circle cx="42" cy="28.7" r="4.1" fill="#270c00" />
      <circle cx="38.1" cy="40.7" r="4.1" fill="#270c00" />
      <circle cx="25.9" cy="40.7" r="4.1" fill="#270c00" />
      <circle cx="22" cy="28.7" r="4.1" fill="#270c00" />
      <circle cx="32" cy="32" r="3.6" fill="#270c00" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <LogoMark className="h-9 w-9 shrink-0" />
      {!compact && (
        <div className="leading-none min-w-0">
          <div className="mt-1 text-[16.5px] font-extrabold tracking-tight text-foreground">
            CHAFIK<span className="text-primary">TECH</span>
          </div>
          <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            AI video prompts
          </div>
        </div>
      )}
    </div>
  );
}
