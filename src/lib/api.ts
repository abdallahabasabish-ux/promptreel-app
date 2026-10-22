import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok(data: unknown, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message);
  // Defense-in-depth: legacy errors created with Object.assign({ status, code })
  const err = e as { status?: unknown; code?: unknown; message?: unknown };
  if (err && typeof err.status === "number" && typeof err.code === "string") {
    return fail(err.status, err.code, typeof err.message === "string" ? err.message : "Request failed.");
  }
  console.error("[api] unexpected error:", e);
  return fail(500, "internal_error", "Something went wrong. Please try again.");
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "bad_request", "Invalid JSON body.");
  }
}

export function str(v: unknown, field: string, opts?: { min?: number; max?: number; optional?: boolean }): string {
  const { min = 0, max = 100000, optional = false } = opts ?? {};
  if (v == null || v === "") {
    if (optional) return "";
    throw new ApiError(400, "validation_error", `${field} is required.`);
  }
  if (typeof v !== "string") throw new ApiError(400, "validation_error", `${field} must be a string.`);
  const t = v.trim();
  if (t.length < min) throw new ApiError(400, "validation_error", `${field} must be at least ${min} characters.`);
  if (t.length > max) throw new ApiError(400, "validation_error", `${field} must be at most ${max} characters.`);
  return t;
}

export function int(v: unknown, field: string, opts?: { min?: number; max?: number; fallback?: number }): number {
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, fallback } = opts ?? {};
  if (v == null && fallback !== undefined) return fallback;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (Number.isNaN(n)) throw new ApiError(400, "validation_error", `${field} must be a number.`);
  if (n < min || n > max) throw new ApiError(400, "validation_error", `${field} must be between ${min} and ${max}.`);
  return n;
}
