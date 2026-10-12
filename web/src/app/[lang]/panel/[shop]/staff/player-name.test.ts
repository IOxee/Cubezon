import { describe, expect, it } from "vitest";
import { parsePlayerName } from "./player-name";

describe("parsePlayerName", () => {
  it("accepts Java and Bedrock names, trimmed", () => {
    expect(parsePlayerName("Steve")).toBe("Steve");
    expect(parsePlayerName("  Alex_99 ")).toBe("Alex_99");
    expect(parsePlayerName("abcdefghijklmnop")).toBe("abcdefghijklmnop");
    expect(parsePlayerName(".BedrockGuy")).toBe(".BedrockGuy");
  });

  it("rejects what can never be a name", () => {
    expect(parsePlayerName("")).toBeNull();
    expect(parsePlayerName("   ")).toBeNull();
    expect(parsePlayerName("abcdefghijklmnopq")).toBeNull();
    expect(parsePlayerName("Steve Jobs")).toBeNull();
    expect(parsePlayerName("St%ve")).toBeNull();
    expect(parsePlayerName(null)).toBeNull();
    expect(parsePlayerName(42)).toBeNull();
  });
});
