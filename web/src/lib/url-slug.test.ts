import { describe, expect, it } from "vitest";
import { keyFromSlug, keySlug } from "./url-slug";

const STATUSES = ["PENDING", "READY", "TO_REVIEW"] as const;

describe("keySlug", () => {
  it("lowercases the key and writes underscores as hyphens", () => {
    expect(keySlug("READY")).toBe("ready");
    expect(keySlug("TO_REVIEW")).toBe("to-review");
    expect(keySlug("blocks")).toBe("blocks");
  });
});

describe("keyFromSlug", () => {
  it("returns the key whose slug matches", () => {
    expect(keyFromSlug(STATUSES, "pending")).toBe("PENDING");
    expect(keyFromSlug(STATUSES, "to-review")).toBe("TO_REVIEW");
  });

  it("returns null for missing or unknown slugs", () => {
    expect(keyFromSlug(STATUSES, undefined)).toBeNull();
    expect(keyFromSlug(STATUSES, "")).toBeNull();
    expect(keyFromSlug(STATUSES, "PENDING")).toBeNull();
    expect(keyFromSlug(STATUSES, "pendientes")).toBeNull();
  });
});
