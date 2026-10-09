/**
 * Minecraft player names typed in the employees form. Java names are 3–16 letters, digits or
 * underscores; Bedrock players (Floodgate) get a "." or "*" prefix. The players table is the real
 * check: this only filters out what can never be a name before querying it.
 */
const PLAYER_NAME = /^[.*]?[A-Za-z0-9_]{1,16}$/;

/** The trimmed name, or null when it cannot be a Minecraft name. */
export function parsePlayerName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return PLAYER_NAME.test(name) ? name : null;
}
