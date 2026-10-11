import "server-only";

import { parseExpressSettings, type ExpressSettings } from "@/lib/delivery";
import { centsToDecimal, toCents } from "@/lib/format";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";
import { parseTipSettings, type TipSettings } from "@/lib/tips";

/**
 * Express delivery to the buyer's mailbox and checkout tips. The settings are public
 * (plugin_settings) and read without cache: the checkout copies the fee into the orders, like
 * unit_price. Mailboxes and shop fees are read with the secret key: mailboxes only for the
 * logged-in player.
 */

async function readPluginSettings(keys: string[]): Promise<(key: string) => string | undefined> {
  const { data, error } = await publicDb().from("plugin_settings").select("key, value").in("key", keys);
  if (error) throw dbError(error);
  return (key) => data.find((row) => row.key === key)?.value;
}

export async function getExpressSettings(): Promise<ExpressSettings> {
  const value = await readPluginSettings(["express_enabled", "express_fee", "express_pricing", "express_max_fee"]);
  return parseExpressSettings(
    value("express_enabled"),
    value("express_fee"),
    value("express_pricing"),
    value("express_max_fee"),
  );
}

export async function getTipSettings(): Promise<TipSettings> {
  const value = await readPluginSettings(["tips_enabled", "tips_max"]);
  return parseTipSettings(value("tips_enabled"), value("tips_max"));
}

/** Each shop's own express fee in cents (shops.express_fee; null = the server's). */
export async function getShopExpressFees(shopIds: readonly string[]): Promise<Map<string, number | null>> {
  if (shopIds.length === 0) return new Map();
  const { data, error } = await adminDb().from("shops").select("id, express_fee").in("id", [...shopIds]);
  if (error) throw dbError(error);
  return new Map(data.map((shop) => [shop.id, shop.express_fee === null ? null : toCents(Number(shop.express_fee))]));
}

/** Saves a shop's own express fee (null = back to the server's). The caller checks owner and range. */
export async function setShopExpressFee(shopId: string, feeCents: number | null): Promise<void> {
  const { error } = await adminDb()
    .from("shops")
    // numeric(14, 2): PostgREST takes a decimal string, which keeps it exact.
    .update({ express_fee: feeCents === null ? null : (centsToDecimal(feeCents) as unknown as number) })
    .eq("id", shopId);
  if (error) throw dbError(error);
}

export type Mailbox = { id: string; world: string; x: number; y: number; z: number };

/** Mailboxes the player placed in the game, oldest first. */
export async function getMyMailboxes(playerUuid: string): Promise<Mailbox[]> {
  const { data, error } = await adminDb()
    .from("mailboxes")
    .select("id, world, x, y, z")
    .eq("owner_uuid", playerUuid)
    .order("created_at", { ascending: true });
  if (error) throw dbError(error);
  return data;
}
