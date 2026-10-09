import { describe, expect, it } from "vitest";
import {
  checkImageFile,
  isShopMediaKind,
  isShopMediaPathOf,
  SHOP_MEDIA_MAX_BYTES,
  shopMediaPath,
  shopMediaUrl,
  sniffImageType,
  validateShopImage,
} from "./shop-media";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
/** RIFF container that is not WebP (a WAV file). */
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

describe("checkImageFile", () => {
  it("accepts PNG, JPEG and WebP up to 2 MB", () => {
    expect(checkImageFile({ type: "image/png", size: 1 })).toBeNull();
    expect(checkImageFile({ type: "image/jpeg", size: 500_000 })).toBeNull();
    expect(checkImageFile({ type: "image/webp", size: SHOP_MEDIA_MAX_BYTES })).toBeNull();
  });

  it("refuses empty, too big or other types", () => {
    expect(checkImageFile({ type: "image/png", size: 0 })).toBe("imageMissing");
    expect(checkImageFile({ type: "image/png", size: SHOP_MEDIA_MAX_BYTES + 1 })).toBe("imageSize");
    expect(checkImageFile({ type: "image/gif", size: 10 })).toBe("imageType");
    expect(checkImageFile({ type: "image/svg+xml", size: 10 })).toBe("imageType");
    expect(checkImageFile({ type: "", size: 10 })).toBe("imageType");
  });
});

describe("sniffImageType", () => {
  it("reads the magic numbers", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("does not recognise anything else", () => {
    expect(sniffImageType(GIF)).toBeNull();
    expect(sniffImageType(SVG)).toBeNull();
    expect(sniffImageType(WAV)).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("validateShopImage", () => {
  it("stores the type the bytes say, with its extension", () => {
    expect(validateShopImage({ type: "image/png", size: PNG.length }, PNG)).toEqual({
      ok: true,
      value: { contentType: "image/png", extension: "png" },
    });
    expect(validateShopImage({ type: "image/jpeg", size: JPEG.length }, JPEG)).toEqual({
      ok: true,
      value: { contentType: "image/jpeg", extension: "jpg" },
    });
    // A PNG renamed to .jpg is still a valid image, saved as what it really is.
    expect(validateShopImage({ type: "image/jpeg", size: PNG.length }, PNG)).toEqual({
      ok: true,
      value: { contentType: "image/png", extension: "png" },
    });
  });

  it("refuses files that only pretend to be images", () => {
    expect(validateShopImage({ type: "image/png", size: SVG.length }, SVG)).toEqual({ ok: false, error: "imageType" });
    expect(validateShopImage({ type: "image/webp", size: WAV.length }, WAV)).toEqual({ ok: false, error: "imageType" });
    expect(validateShopImage({ type: "image/gif", size: GIF.length }, GIF)).toEqual({ ok: false, error: "imageType" });
  });

  it("checks the size of the bytes too, not only the declared one", () => {
    const big = new Uint8Array(SHOP_MEDIA_MAX_BYTES + 1);
    big.set(PNG);
    expect(validateShopImage({ type: "image/png", size: 10 }, big)).toEqual({ ok: false, error: "imageSize" });
    expect(validateShopImage({ type: "image/png", size: 0 }, new Uint8Array())).toEqual({ ok: false, error: "imageMissing" });
  });
});

describe("paths and URLs", () => {
  const shopId = "0b7e7f1e-3a52-4d8e-9a43-5d1f1f0c2a11";

  it("builds one path per shop, kind and upload", () => {
    expect(shopMediaPath(shopId, "logo", 1_760_000_000_123, "png")).toBe(`shops/${shopId}/logo-1760000000123.png`);
    expect(shopMediaPath(shopId, "banner", 42.9, "webp")).toBe(`shops/${shopId}/banner-42.webp`);
  });

  it("only treats this shop's own images as deletable", () => {
    expect(isShopMediaPathOf(shopId, `shops/${shopId}/logo-1.png`)).toBe(true);
    expect(isShopMediaPathOf(shopId, `shops/${shopId}/banner-99.jpg`)).toBe(true);
    expect(isShopMediaPathOf(shopId, "shops/another-shop/logo-1.png")).toBe(false);
    expect(isShopMediaPathOf(shopId, `shops/${shopId}/../other/logo-1.png`)).toBe(false);
    expect(isShopMediaPathOf(shopId, `shops/${shopId}/notes.txt`)).toBe(false);
    expect(isShopMediaPathOf(shopId, null)).toBe(false);
    expect(isShopMediaPathOf("", "shops//logo-1.png")).toBe(false);
  });

  it("builds the public URL of the bucket", () => {
    expect(shopMediaUrl(`shops/${shopId}/logo-1.png`, "https://abc.supabase.co/")).toBe(
      `https://abc.supabase.co/storage/v1/object/public/shop-media/shops/${shopId}/logo-1.png`,
    );
    expect(shopMediaUrl(null, "https://abc.supabase.co")).toBeNull();
    expect(shopMediaUrl("shops/x/logo-1.png", undefined)).toBeNull();
  });

  it("knows the two kinds of image", () => {
    expect(isShopMediaKind("logo")).toBe(true);
    expect(isShopMediaKind("banner")).toBe(true);
    expect(isShopMediaKind("avatar")).toBe(false);
  });
});
