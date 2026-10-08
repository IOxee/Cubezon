import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit inside a window, then blocks", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(limiter.hit("ip", 0)).toEqual({ ok: true, remaining: 2, retryAfterMs: 1000 });
    expect(limiter.hit("ip", 100).ok).toBe(true);
    expect(limiter.hit("ip", 200)).toEqual({ ok: true, remaining: 0, retryAfterMs: 800 });
    expect(limiter.hit("ip", 300)).toEqual({ ok: false, remaining: 0, retryAfterMs: 700 });
    expect(limiter.hit("ip", 999).ok).toBe(false);
  });

  it("opens a new window when the old one expires", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.hit("ip", 0).ok).toBe(true);
    expect(limiter.hit("ip", 500).ok).toBe(false);
    expect(limiter.hit("ip", 1000)).toEqual({ ok: true, remaining: 0, retryAfterMs: 1000 });
  });

  it("counts each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.hit("a", 0).ok).toBe(true);
    expect(limiter.hit("b", 0).ok).toBe(true);
    expect(limiter.hit("a", 1).ok).toBe(false);
  });

  it("forgets a key on reset", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.hit("ip", 0);
    expect(limiter.hit("ip", 1).ok).toBe(false);
    limiter.reset("ip");
    expect(limiter.hit("ip", 2).ok).toBe(true);
  });

  it("sweeps expired windows so memory stays bounded", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000 });
    for (let i = 0; i < 1000; i++) limiter.hit(`ip-${i}`, 0);
    expect(limiter.size()).toBe(1000);
    limiter.hit("late", 5000);
    expect(limiter.size()).toBe(1);
  });

  it("rejects invalid settings", () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => createRateLimiter({ limit: 1.5, windowMs: 1000 })).toThrow();
    expect(() => createRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe("clientIp", () => {
  it("takes the first address of x-forwarded-for", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1, 10.0.0.2")).toBe("203.0.113.7");
    expect(clientIp("  2001:db8::1  ")).toBe("2001:db8::1");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(null, "198.51.100.4")).toBe("198.51.100.4");
    expect(clientIp("", " ")).toBe("unknown");
    expect(clientIp(undefined)).toBe("unknown");
  });

  it("truncates absurdly long values", () => {
    expect(clientIp("x".repeat(500))).toHaveLength(64);
  });
});
