import type { Messages } from "@/i18n";

/** Localized name of a Minecraft world folder (world_nether -> "Nether"), or the raw name. */
export function worldName(m: Messages, world: string): string {
  const names: Record<string, string> = m.worlds;
  return names[world] ?? world;
}
