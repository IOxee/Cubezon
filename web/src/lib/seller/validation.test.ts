import { describe, expect, it } from "vitest";
import {
  charLength,
  isValidSlug,
  maxUnitAmount,
  normalizeMaterial,
  parsePriceCents,
  parseUnitAmount,
  priceInputValue,
  slugDraft,
  slugify,
  validateListing,
  validateShop,
} from "./validation";

describe("slugify", () => {
  it("lowercases, strips accents and joins words with dashes", () => {
    expect(slugify("Minas Paco")).toBe("minas-paco");
    expect(slugify("  Ñandú & Cía.  ")).toBe("nandu-cia");
    expect(slugify("Árbol---Mágico__2")).toBe("arbol-magico-2");
  });

  it("caps the length without leaving a trailing dash", () => {
    const slug = slugify("a".repeat(39) + " bbbb");
    expect(slug).toBe("a".repeat(39));
    expect(isValidSlug(slug)).toBe(true);
  });

  it("returns an empty string when nothing is usable", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("slugDraft", () => {
  it("keeps a trailing dash while typing", () => {
    expect(slugDraft("Mi ")).toBe("mi-");
    expect(slugDraft("mi-t")).toBe("mi-t");
  });
});

describe("isValidSlug", () => {
  it("matches the database check", () => {
    expect(isValidSlug("minas-paco")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
    expect(isValidSlug("a--bc")).toBe(false);
    expect(isValidSlug("Abc")).toBe(false);
  });
});

describe("parsePriceCents", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12.50", 1250],
    ["0,01", 1],
    ["1.250", 125000],
    ["1.250,50", 125050],
    ["1 250,5", 125050],
    ["12,50 $", 1250],
    ["1000000000", 100_000_000_000],
  ])("parses %s", (input, cents) => {
    expect(parsePriceCents(input)).toEqual({ cents });
  });

  it.each(["", "abc", "12,345", "1,250.50", "-5", "12,", "0.500"])("rejects the format of %s", (input) => {
    expect(parsePriceCents(input)).toEqual({ error: "priceFormat" });
  });

  it.each(["0", "0,00", "1000000000,01", "99999999999999"])("rejects the range of %s", (input) => {
    expect(parsePriceCents(input)).toEqual({ error: "priceRange" });
  });

  it("rejects anything that is not text or a number", () => {
    expect(parsePriceCents(null)).toEqual({ error: "priceFormat" });
  });
});

describe("priceInputValue", () => {
  it("uses a decimal comma and two decimals", () => {
    expect(priceInputValue(1250.5)).toBe("1250,50");
    expect(priceInputValue(0.29)).toBe("0,29");
    expect(parsePriceCents(priceInputValue(19.99))).toEqual({ cents: 1999 });
  });
});

describe("normalizeMaterial", () => {
  it("removes the namespace and normalises separators", () => {
    expect(normalizeMaterial(" Minecraft:Diamond Sword ")).toBe("diamond_sword");
    expect(normalizeMaterial("ender-pearl")).toBe("ender_pearl");
    expect(normalizeMaterial(42)).toBe("");
  });
});

describe("parseUnitAmount", () => {
  it("accepts whole numbers from 1 to 64", () => {
    expect(parseUnitAmount("1")).toBe(1);
    expect(parseUnitAmount(" 64 ")).toBe(64);
    expect(parseUnitAmount("0")).toBeNull();
    expect(parseUnitAmount("65")).toBeNull();
    expect(parseUnitAmount("1.5")).toBeNull();
    expect(parseUnitAmount("")).toBeNull();
  });
});

describe("charLength", () => {
  it("counts code points like char_length", () => {
    expect(charLength("ñandú")).toBe(5);
    expect(charLength("🧱🧱")).toBe(2);
  });
});

describe("validateShop", () => {
  const valid = { name: "  Minas   Paco ", slug: "", description: "Picos.\r\nY palas.", ink: "azul" };

  it("cleans the input and derives the slug from the name", () => {
    expect(validateShop(valid)).toEqual({
      ok: true,
      value: { name: "Minas Paco", slug: "minas-paco", description: "Picos.\nY palas.", ink: "azul" },
    });
  });

  it("normalises a typed slug", () => {
    const result = validateShop({ ...valid, slug: "Mi Tienda!" });
    expect(result.ok && result.value.slug).toBe("mi-tienda");
  });

  it("reports every invalid field", () => {
    const result = validateShop({ name: "ab", slug: "!", description: "x".repeat(501), ink: "rosa" });
    expect(result).toEqual({
      ok: false,
      errors: { name: "nameLength", slug: "slugFormat", description: "descriptionLength", ink: "inkInvalid" },
    });
  });

  it("counts the description after normalising line breaks", () => {
    const description = "a\r\n".repeat(250).trim();
    expect(validateShop({ ...valid, description }).ok).toBe(true);
  });
});

describe("validateListing", () => {
  const valid = {
    title: "Pico de diamante",
    description: "",
    item: "diamond_pickaxe",
    unitAmount: "1",
    unitPrice: "150,5",
    status: "ACTIVE",
  };

  it("returns the parsed listing", () => {
    expect(validateListing(valid)).toEqual({
      ok: true,
      value: {
        title: "Pico de diamante",
        description: "",
        priceCents: 15050,
        status: "ACTIVE",
        format: { itemKey: "minecraft:diamond_pickaxe", material: "diamond_pickaxe", unitAmount: 1 },
      },
    });
  });

  it("keeps a unit inside one stack of the material", () => {
    expect(validateListing({ ...valid, unitAmount: "2" })).toEqual({ ok: false, errors: { unitAmount: "unitAmountStack" } });
    expect(validateListing({ ...valid, item: "ender_pearl", unitAmount: "17" })).toEqual({
      ok: false,
      errors: { unitAmount: "unitAmountStack" },
    });
    expect(validateListing({ ...valid, item: "ender_pearl", unitAmount: "16" }).ok).toBe(true);
    expect(validateListing({ ...valid, item: "diamond", unitAmount: "64" }).ok).toBe(true);
    expect(maxUnitAmount("diamond_sword")).toBe(1);
    expect(maxUnitAmount("oak_sign")).toBe(16);
    expect(maxUnitAmount("stone")).toBe(64);
  });

  it("does not read the format again once it is locked", () => {
    const result = validateListing({ ...valid, unitAmount: "80" }, { formatLocked: true });
    expect(result.ok && result.value.format).toBeNull();
  });

  it("accepts the key of a registered custom item, with its own stack size", () => {
    const customItems = [{ key: "nexo:ruby", name: "Rubí", material: "emerald", maxStack: 16, iconPath: null }];
    const result = validateListing({ ...valid, item: "nexo:ruby", unitAmount: "16" }, { customItems });
    expect(result.ok && result.value.format).toEqual({ itemKey: "nexo:ruby", material: "emerald", unitAmount: 16 });
    expect(validateListing({ ...valid, item: "nexo:ruby", unitAmount: "17" }, { customItems }).ok).toBe(false);
    expect(validateListing({ ...valid, item: "nexo:zafiro" }, { customItems })).toEqual({
      ok: false,
      errors: { item: "itemUnknown" },
    });
  });

  it("reports every invalid field", () => {
    const result = validateListing({
      title: "ab",
      description: "x".repeat(501),
      item: "diamond pickaxe!",
      unitAmount: "99",
      unitPrice: "12,345",
      status: "REMOVED",
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        title: "titleLength",
        description: "descriptionLength",
        item: "materialFormat",
        unitAmount: "unitAmountRange",
        unitPrice: "priceFormat",
        status: "statusInvalid",
      },
    });
  });
});
