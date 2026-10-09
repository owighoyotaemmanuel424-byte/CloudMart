import { NextResponse } from "next/server";

/**
 * Process-local fixed-window rate limiting.
 *
 * This stops online guessing and cheap resource exhaustion from a single
 * instance. It is deliberately dependency-free: a multi-instance deployment
 * should move the same keys to a shared store (Redis/D1) so the counters are
 * global rather than per process.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 20_000;

export type RateLimitCheck = { key: string; limit: number; windowMs: number };
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number; key: string };

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(check: RateLimitCheck): RateLimitResult {
  const now = Date.now();
  if (buckets.size >= MAX_TRACKED_KEYS) pruneExpired(now);

  const bucket = buckets.get(check.key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(check.key, { count: 1, resetAt: now + check.windowMs });
    return { ok: true };
  }

  if (bucket.count >= check.limit) {
    return {
      ok: false,
      key: check.key,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

export function rateLimitAll(checks: RateLimitCheck[]): RateLimitResult {
  for (const check of checks) {
    const result = rateLimit(check);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Coarse client identity. Forwarded headers are only trustworthy behind a
 * proxy that overwrites them, so every caller also applies a global cap that
 * a spoofed address cannot bypass.
 */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyRequests(result: { retryAfterSeconds: number }) {
  return NextResponse.json(
    { ok: false, error: "Too many attempts. Please try again later." },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfterSeconds),
        "cache-control": "no-store",
      },
    },
  );
}

export const RATE_LIMIT_WINDOWS = {
  quarterHour: 15 * 60 * 1000,
  hour: 60 * 60 * 1000,
} as const;
