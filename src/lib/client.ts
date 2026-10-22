"use client";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerified: boolean;
  theme: string;
  defaultSceneCount: number;
  defaultLanguageCode: string;
  planId: string | null;
  planName: string | null;
  planPeriodEnd: string | null;
  createdAt: string;
};

export type Usage = {
  used: number;
  limit: number; // -1 unlimited
  planName: string;
  planSlug: string;
  maxVideoMb: number;
  periodEnd: string | null;
};

export type Language = { id: string; name: string; nativeName: string; code: string; isActive: boolean; sortOrder: number };

export type Plan = {
  id: string; name: string; slug: string; description: string;
  priceCents: number; currency: string; monthlyGenerations: number;
  maxVideoMb: number; features: string[]; isActive: boolean;
};

export type Flags = {
  googleOAuth: boolean;
  stripe: boolean;
  smtp: boolean;
  exposeDevLinks: boolean;
  emailVerificationRequired: boolean;
  maintenanceMode: boolean;
};

export type Boot = {
  user: AppUser | null;
  usage?: Usage;
  flags?: Flags;
  settings?: { welcomeMessage: string };
  languages?: Language[];
  plans?: Plan[];
};

export type Scene = {
  idx: number;
  title: string;
  durationSec: number;
  imagePrompt: string;
  videoPrompt: string;
  dialogue: string | null;
  camera: string | null;
  transition: string | null;
};

export type ProjectSummary = {
  id: string; title: string; status: string; sceneCount: number;
  languageName: string; hasVideo: boolean; shareEnabled: boolean;
  createdAt: string; completedAt: string | null;
};

export type ProjectDetail = ProjectSummary & {
  idea: string;
  languageCode: string;
  progress: number;
  statusMessage: string;
  modelUsed: string | null;
  error: string | null;
  shareToken: string | null;
  video: { filename: string; sizeBytes: number } | null;
  scenes: Scene[];
};

export type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const opts: RequestInit = { ...init };
  opts.headers = { ...(init?.headers as Record<string, string>) };
  if (init?.json !== undefined) {
    opts.body = JSON.stringify(init.json);
    opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, opts);
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError("network_error", "Network error — please try again.", res.status);
  }
  if (!body || !body.ok) {
    throw new ApiClientError(body?.error?.code ?? "error", body?.error?.message ?? "Request failed.", res.status);
  }
  return body.data;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function isRtlText(text: string): boolean {
  return /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(text);
}

export function groupByDate<T extends { createdAt: string }>(items: T[]): { label: string; items: T[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const week = startOfToday - 6 * 86400000;
  const month = startOfToday - 29 * 86400000;
  const groups: Record<string, T[]> = {
    Today: [], Yesterday: [], "Previous 7 Days": [], "Previous 30 Days": [], Older: [],
  };
  for (const item of items) {
    const t = new Date(item.createdAt).getTime();
    if (t >= startOfToday) groups.Today.push(item);
    else if (t >= startOfYesterday) groups.Yesterday.push(item);
    else if (t >= week) groups["Previous 7 Days"].push(item);
    else if (t >= month) groups["Previous 30 Days"].push(item);
    else groups.Older.push(item);
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}
