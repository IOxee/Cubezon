import { describe, expect, it } from "vitest";
import { playerHeadUrl } from "./player-head";

describe("playerHeadUrl", () => {
  it("asks for the face by uuid without dashes, at twice the size", () => {
    expect(playerHeadUrl("8d40c6f1-eef4-441e-ac2d-e55fd0208ae2", 56)).toBe(
      "https://mc-heads.net/avatar/8d40c6f1eef4441eac2de55fd0208ae2/112",
    );
  });

  it("keeps the size between 8 and 512 px", () => {
    expect(playerHeadUrl("x", 1).endsWith("/8")).toBe(true);
    expect(playerHeadUrl("x", 1000).endsWith("/512")).toBe(true);
  });
});
