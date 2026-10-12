import { describe, expect, it } from "vitest";
import { itemName } from "./items";
import { messagesFor } from "./messages";

type Tree = string | readonly Tree[] | { readonly [key: string]: Tree };

/** Every text with its path: "cart.units.one" -> "{count} unit". */
function leaves(tree: Tree, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof tree === "string") return out.set(path, tree);
  const entries = Array.isArray(tree) ? tree.map((value, index) => [String(index), value] as const) : Object.entries(tree);
  for (const [key, value] of entries) {
    for (const [leafPath, text] of leaves(value as Tree, path ? `${path}.${key}` : key)) out.set(leafPath, text);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("messages", () => {
  const en = leaves(messagesFor("en") as Tree);
  const es = leaves(messagesFor("es") as Tree);

  it("have the same texts in both languages, including list lengths", () => {
    expect([...en.keys()].sort()).toEqual([...es.keys()].sort());
  });

  it("keep the same {placeholders} in every translation", () => {
    const mismatches = [...en].filter(([path, text]) => placeholders(text).join() !== placeholders(es.get(path) ?? "").join());
    expect(mismatches.map(([path]) => path)).toEqual([]);
  });

  it("leave no text empty", () => {
    expect([...en, ...es].filter(([, text]) => text.trim() === "").map(([path]) => path)).toEqual([]);
  });
});

describe("itemName", () => {
  it("uses Minecraft's English names", () => {
    expect(itemName("diamond_sword", "en")).toBe("Diamond Sword");
    expect(itemName("heart_of_the_sea", "en")).toBe("Heart of the Sea");
    expect(itemName("tnt", "en")).toBe("TNT");
  });

  it("keeps the Spanish names", () => {
    expect(itemName("diamond_sword", "es")).toBe("Espada de diamante");
  });
});
