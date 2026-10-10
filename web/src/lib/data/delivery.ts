import "server-only";

import { parseExpressSettings, type ExpressSettings } from "@/lib/delivery";
import { adminDb, dbError, publicDb } from "@/lib/supabase/server";

/**
 * Express delivery to the buyer's mailbox. The settings are public (plugin_settings) and read
 * without cache: the checkout copies the fee into the orders, like unit_price. Mailboxes are
 * private (secret key): read them only for the logged-in player.
 */

export async function getExpressSettings(): Promise<ExpressSettings> {
  const { data, error } = await publicDb()
    .from("plugin_settings")
    .select("key, value")
    .in("key", ["express_enabled", "express_fee"]);
  if (error) throw dbError(error);
  const value = (key: string) => data.find((row) => row.key === key)?.value;
  return parseExpressSettings(value("express_enabled"), value("express_fee"));
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
