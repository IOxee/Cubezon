/**
 * Face of a player's skin (with the hat layer), from a skin service, by Mojang UUID (the server
 * runs in online mode). Configurable with NEXT_PUBLIC_PLAYER_HEAD_URL ({uuid} and {size}).
 */
const HEAD_URL = process.env.NEXT_PUBLIC_PLAYER_HEAD_URL ?? "https://mc-heads.net/avatar/{uuid}/{size}";

/** URL of the face at `size` px (asked at twice the size for sharp screens, at most 512). */
export function playerHeadUrl(uuid: string, size: number): string {
  const pixels = Math.min(512, Math.max(8, Math.round(size * 2)));
  return HEAD_URL.replace("{uuid}", encodeURIComponent(uuid.replace(/-/g, ""))).replace("{size}", String(pixels));
}
