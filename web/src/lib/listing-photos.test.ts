import { describe, expect, it } from "vitest";
import { isListingPhotoPathOf, listingPhotoPath, listingPhotoUrl } from "./listing-photos";

const LISTING = "7b0f4f9e-58a4-4e43-9d55-0c1d2f3a4b5c";
const OTHER = "11111111-2222-4333-8444-555555555555";

describe("listing photo paths", () => {
  it("names each upload after the listing and the time, so caches never serve an old one", () => {
    expect(listingPhotoPath(LISTING, 1733000000123.7, "webp")).toBe(`listings/${LISTING}/photo-1733000000123.webp`);
  });

  it("only recognises this listing's photos (nothing else is ever deleted)", () => {
    expect(isListingPhotoPathOf(LISTING, `listings/${LISTING}/photo-1.png`)).toBe(true);
    expect(isListingPhotoPathOf(LISTING, `listings/${OTHER}/photo-1.png`)).toBe(false);
    expect(isListingPhotoPathOf(LISTING, `listings/${LISTING}/../${OTHER}/photo-1.png`)).toBe(false);
    expect(isListingPhotoPathOf(LISTING, `listings/${LISTING}/photo-1.svg`)).toBe(false);
    expect(isListingPhotoPathOf(LISTING, null)).toBe(false);
  });

  it("builds the public URL of the bucket", () => {
    expect(listingPhotoUrl(`listings/${LISTING}/photo-1.jpg`, "https://x.supabase.co/")).toBe(
      `https://x.supabase.co/storage/v1/object/public/listing-photos/listings/${LISTING}/photo-1.jpg`,
    );
    expect(listingPhotoUrl(null, "https://x.supabase.co")).toBeNull();
  });
});
