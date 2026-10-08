import { describe, expect, it } from "vitest";
import { RATING_STEPS, parseRating, ratingBucket, roundToHalf, starFill } from "./rating";

describe("parseRating", () => {
  it("accepts half steps from 0.5 to 5", () => {
    expect(RATING_STEPS).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(parseRating("3.5")).toBe(3.5);
    expect(parseRating("5")).toBe(5);
    expect(parseRating("0.5")).toBe(0.5);
  });

  it("rejects anything else", () => {
    for (const raw of ["0", "3.3", "5.5", "6", "-1", "", "abc", "3,5", null, 4]) {
      expect(parseRating(raw)).toBeNull();
    }
  });
});

describe("starFill and roundToHalf", () => {
  it("fills whole and half squares", () => {
    expect([1, 2, 3, 4, 5].map((n) => starFill(3.5, n))).toEqual(["full", "full", "full", "half", "empty"]);
    expect([1, 2, 3, 4, 5].map((n) => starFill(0.5, n))).toEqual(["half", "empty", "empty", "empty", "empty"]);
  });

  it("rounds averages to the nearest half star", () => {
    expect(roundToHalf(4.27)).toBe(4.5);
    expect(roundToHalf(4.2)).toBe(4);
    expect(roundToHalf(7)).toBe(5);
  });
});

describe("ratingBucket", () => {
  it("puts half stars in the next whole star", () => {
    expect(ratingBucket(0.5)).toBe(1);
    expect(ratingBucket(3.5)).toBe(4);
    expect(ratingBucket(4)).toBe(4);
    expect(ratingBucket(5)).toBe(5);
  });
});
