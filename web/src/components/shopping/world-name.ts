import { m } from "@/i18n";

/** Spanish name of a Minecraft world folder (world_nether -> "Nether"), or the raw name. */
export function worldName(world: string): string {
  const names: Record<string, string> = m.worlds;
  return names[world] ?? world;
}
