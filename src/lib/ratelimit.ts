/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-node deployments (VPS/PM2). For multi-instance
 * deployments behind a load balancer, move this to Redis.
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < 3_600_000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export type RateResult = { allowed: boolean; retryAfterSec: number; remaining: number };

/**
 * Consume one hit for `key`. Returns whether the request is allowed.
 * @param key     stable identifier, e.g. `signin:ip:1.2.3.4` or `signup:ip:1.2.3.4`
 * @param limit   max hits inside the window
 * @param windowMs window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0, remaining: limit - bucket.hits.length };
}

/** Best-effort client IP extraction behind proxies (Nginx / Vercel). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
