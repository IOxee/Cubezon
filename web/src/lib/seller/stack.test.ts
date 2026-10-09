import { describe, expect, it } from "vitest";
import { maxStackSize } from "./stack";

describe("maxStackSize", () => {
  it.each(["diamond_sword", "netherite_pickaxe", "elytra", "potion", "water_bucket", "red_bed", "shulker_box", "cake"])(
    "%s stacks to 1",
    (material) => {
      expect(maxStackSize(material)).toBe(1);
    },
  );

  it.each(["ender_pearl", "snowball", "egg", "bucket", "oak_sign", "crimson_hanging_sign", "white_banner", "written_book"])(
    "%s stacks to 16",
    (material) => {
      expect(maxStackSize(material)).toBe(16);
    },
  );

  it.each(["diamond", "stone", "oak_log", "arrow", "ender_eye", "unknown_modded_item"])("%s stacks to 64", (material) => {
    expect(maxStackSize(material)).toBe(64);
  });
});
