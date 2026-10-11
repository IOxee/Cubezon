import { describe, expect, it } from "vitest";
import { FEATURES, featureDef, parseFeatureForm, parseFeatureInput, parsePublishedFeatures } from "./features";

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe("parseFeatureInput", () => {
  it("empty means going back to the server's config.yml", () => {
    expect(parseFeatureInput(featureDef("mailbox.express.enabled"), "")).toBeNull();
    expect(parseFeatureInput(featureDef("mailbox.express.fee"), "   ")).toBeNull();
    expect(parseFeatureInput(featureDef("mailbox.express.fee"), null)).toBeNull();
  });

  it("accepts each kind within its range", () => {
    expect(parseFeatureInput(featureDef("mailbox.express.enabled"), "false")).toBe("false");
    expect(parseFeatureInput(featureDef("computer.buy.price"), "12,5")).toBe("12.5");
    expect(parseFeatureInput(featureDef("orders.roleplay.courier-max-percent"), "30")).toBe("30");
  });

  it("rejects malformed or out of range values", () => {
    expect(parseFeatureInput(featureDef("mailbox.express.enabled"), "yes")).toBeUndefined();
    expect(parseFeatureInput(featureDef("orders.roleplay.courier-max-percent"), "101")).toBeUndefined();
    expect(parseFeatureInput(featureDef("computer.buy.price"), "-3")).toBeUndefined();
    expect(parseFeatureInput(featureDef("computer.buy.price"), "1.234")).toBeUndefined();
    expect(parseFeatureInput(featureDef("mailbox.max-per-player"), "2.5")).toBeUndefined();
  });
});

describe("parseFeatureForm", () => {
  it("returns one change per option: a value or null to reset it", () => {
    const result = parseFeatureForm(form({ "mailbox.express.enabled": "false" }), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changes).toHaveLength(FEATURES.length);
    expect(result.changes).toContainEqual({ key: "mailbox.express.enabled", value: "false" });
    expect(result.changes).toContainEqual({ key: "mailbox.express.fee", value: null });
  });

  it("lists every invalid field", () => {
    const result = parseFeatureForm(form({ "computer.buy.price": "abc", "mailbox.max-per-player": "99" }), {});
    expect(result).toEqual({ ok: false, invalid: ["computer.buy.price", "mailbox.max-per-player"], delays: false });
  });

  it("refuses a minimum delay above the maximum, counting what is in force", () => {
    const published = { "orders.automatic.delay-max-minutes": 10 };
    expect(parseFeatureForm(form({ "orders.automatic.delay-min-minutes": "20" }), published))
      .toEqual({ ok: false, invalid: [], delays: true });
    expect(parseFeatureForm(form({ "orders.automatic.delay-min-minutes": "5" }), published).ok).toBe(true);
  });
});

describe("parsePublishedFeatures", () => {
  it("keeps known options with the right type and drops the rest", () => {
    const json = JSON.stringify({
      "mailbox.express.enabled": false,
      "mailbox.express.fee": 100.0,
      "orders.mode": "roleplay",
      "mailbox.max-per-player": "lots",
    });
    expect(parsePublishedFeatures(json)).toEqual({ "mailbox.express.enabled": false, "mailbox.express.fee": 100 });
  });

  it("survives missing or broken JSON", () => {
    expect(parsePublishedFeatures(undefined)).toEqual({});
    expect(parsePublishedFeatures("{not json")).toEqual({});
  });
});
