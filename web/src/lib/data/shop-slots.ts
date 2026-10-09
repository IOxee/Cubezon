import "server-only";

import { cache } from "react";
import { countsTowardShopLimit, resolveShopSlots, type ShopSlots } from "@/lib/seller/shops";
import { adminDb, dbError } from "@/lib/supabase/server";

/**
 * Shop slots: how many shops each player may have. The database owns the rule
 * (public.shop_slots_of, trigger shops_check_slots); the web only reads it and, for superadmins,
 * changes players.shop_slots. The default comes from the plugin's config.yml
 * (plugin_settings.default_shop_slots) and is read-only here, like the global limit of shops a
 * player may work in as an employee (max_shop_memberships, trigger shop_members_check_limit).
 * Secret key: call getShopSlots() only for the signed-in player, the rest after
 * requireStaff("SUPERADMIN").
 */

export type { ShopSlots };

/** Players per page in /admin/jugadores. */
export const PLAYER_SLOTS_PAGE_SIZE = 50;

/** No player row (it cannot own shops either): no slot to use. */
const NO_SLOTS: ShopSlots = { slots: 0, used: 0, free: 0, custom: false };

/** Slots, shops using them, free slots and whether the number is the player's own. Deduplicated per request. */
export const getShopSlots = cache(async (playerUuid: string): Promise<ShopSlots> => {
  const { data, error } = await adminDb().rpc("shop_slots_of", { p_player: playerUuid });
  if (error) throw dbError(error);
  const row = data[0];
  return row ? { slots: row.slots, used: row.used, free: row.free, custom: row.custom } : NO_SLOTS;
});

/** Slots of a player without their own number (config.yml shops.default-slots; 1 if the plugin never published it). */
export async function getDefaultShopSlots(): Promise<number> {
  const { data, error } = await adminDb().rpc("default_shop_slots");
  if (error) throw dbError(error);
  return data;
}

/** Global limit of other people's shops a player may work in (config.yml shops.max-memberships; 1 if missing). */
export async function getMaxShopMemberships(): Promise<number> {
  const { data, error } = await adminDb().rpc("max_shop_memberships");
  if (error) throw dbError(error);
  return data;
}

/** Read-only settings the plugin publishes from its config.yml. */
export type PluginShopSettings = { defaultSlots: number; maxMemberships: number };

export type PlayerShopSlots = ShopSlots & {
  uuid: string;
  name: string;
  /** Shops where they work as an employee (shop_members). */
  memberships: number;
};

export type PlayerSlotsQuery = {
  /** Part of the in-game name (case-insensitive); empty lists everyone. */
  q: string;
  /** Only players with their own number of slots. */
  customOnly: boolean;
  page: number;
};

/** Escapes LIKE wildcards so the search matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function countUp(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Players by name with their shop slots and the shops they work in (superadmin), plus the
 * plugin's settings. One query for the players, then one for their shops and one for their jobs.
 */
export async function searchPlayerSlots(
  query: PlayerSlotsQuery,
): Promise<{ players: PlayerShopSlots[]; total: number; settings: PluginShopSettings }> {
  const from = (query.page - 1) * PLAYER_SLOTS_PAGE_SIZE;
  let players = adminDb().from("players").select("uuid, name, shop_slots", { count: "exact" });
  if (query.q) players = players.ilike("name", `%${escapeLike(query.q)}%`);
  if (query.customOnly) players = players.not("shop_slots", "is", null);

  const [found, defaultSlots, maxMemberships] = await Promise.all([
    players.order("name").order("uuid").range(from, from + PLAYER_SLOTS_PAGE_SIZE - 1),
    getDefaultShopSlots(),
    getMaxShopMemberships(),
  ]);
  if (found.error) throw dbError(found.error);

  const uuids = found.data.map((player) => player.uuid);
  const used = new Map<string, number>();
  const memberships = new Map<string, number>();
  if (uuids.length > 0) {
    const [shops, jobs] = await Promise.all([
      adminDb().from("shops").select("owner_uuid, status").in("owner_uuid", uuids),
      adminDb().from("shop_members").select("player_uuid").in("player_uuid", uuids),
    ]);
    if (shops.error) throw dbError(shops.error);
    if (jobs.error) throw dbError(jobs.error);
    for (const shop of shops.data) {
      if (countsTowardShopLimit(shop.status)) countUp(used, shop.owner_uuid);
    }
    for (const job of jobs.data) countUp(memberships, job.player_uuid);
  }

  return {
    players: found.data.map((player) => ({
      uuid: player.uuid,
      name: player.name,
      memberships: memberships.get(player.uuid) ?? 0,
      ...resolveShopSlots(player.shop_slots, defaultSlots, used.get(player.uuid) ?? 0),
    })),
    total: found.count ?? 0,
    settings: { defaultSlots, maxMemberships },
  };
}

/**
 * Sets a player's own slots (null: back to the default). Shops they already have are never
 * touched, even above the new number. Returns their name, or null if the player does not exist.
 */
export async function setPlayerShopSlots(playerUuid: string, slots: number | null): Promise<string | null> {
  const { data, error } = await adminDb()
    .from("players")
    .update({ shop_slots: slots })
    .eq("uuid", playerUuid)
    .select("name")
    .maybeSingle();
  if (error) throw dbError(error);
  return data?.name ?? null;
}
