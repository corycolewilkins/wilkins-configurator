type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
};

declare global {
  var __wilkinsRateLimitStore: Map<string, Bucket> | undefined;
}

const store = globalThis.__wilkinsRateLimitStore ?? new Map<string, Bucket>();
globalThis.__wilkinsRateLimitStore = store;

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSec: 0,
      resetAt,
    };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      ok: false,
      remaining: 0,
      retryAfterSec,
      resetAt: existing.resetAt,
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSec: 0,
    resetAt: existing.resetAt,
  };
}
