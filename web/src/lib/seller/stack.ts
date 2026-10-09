import stacks from "./max-stack-sizes.json";

/**
 * Max stack size of a game material. One unit of a listing is a single ItemStack (plugin 0.0.6
 * rejects deposits otherwise), so unit_amount can never exceed it.
 *
 * max-stack-sizes.json is a copy of cubezon/docs/data/max-stack-sizes-1.21.11.json (generated
 * from minecraft-data for the server version): Turbopack does not resolve files outside web/.
 * Keep both in sync when the server version changes.
 */

const SIZES = new Map<string, number>([
  ...stacks["1"].map((material) => [material, 1] as const),
  ...stacks["16"].map((material) => [material, 16] as const),
]);

export function maxStackSize(material: string): number {
  return SIZES.get(material) ?? stacks.default;
}
