/**
 * Fixed-window rate limiter kept in memory (one per server instance). Enough for a prototype
 * behind a single Next.js process: it slows down brute force of link codes. Pure (time is
 * passed in), so it can be unit tested.
 */

export type RateLimitResult = {
  ok: boolean;
  /** Attempts left in the current window. */
  remaining: number;
  /** Milliseconds until the window resets (0 when ok and nothing was counted yet). */
  retryAfterMs: number;
};

export type RateLimiter = {
  /** Counts one attempt for key and says whether it is allowed. */
  hit(key: string, now?: number): RateLimitResult;
  /** Forgets a key (e.g. after a successful login). */
  reset(key: string): void;
  /** Number of keys tracked (for tests). */
  size(): number;
};

type Window = { count: number; resetAt: number };

/** Keys tracked before expired windows are swept, so memory stays bounded. */
const SWEEP_THRESHOLD = 1000;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
  if (!(windowMs > 0)) throw new Error("windowMs must be positive");

  const windows = new Map<string, Window>();

  function sweep(now: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  return {
    hit(key, now = Date.now()) {
      if (windows.size >= SWEEP_THRESHOLD) sweep(now);

      let window = windows.get(key);
      if (!window || window.resetAt <= now) {
        window = { count: 0, resetAt: now + windowMs };
        windows.set(key, window);
      }

      if (window.count >= limit) {
        return { ok: false, remaining: 0, retryAfterMs: window.resetAt - now };
      }
      window.count += 1;
      return { ok: true, remaining: limit - window.count, retryAfterMs: window.resetAt - now };
    },
    reset(key) {
      windows.delete(key);
    },
    size() {
      return windows.size;
    },
  };
}

/**
 * Client IP from an x-forwarded-for value: the first address of the list (the client as
 * seen by the first proxy). Falls back to "unknown", so every request without the header
 * shares one bucket.
 */
export function clientIp(forwardedFor: string | null | undefined, realIp?: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = realIp?.trim();
  return real ? real.slice(0, 64) : "unknown";
}
