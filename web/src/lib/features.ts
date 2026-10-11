/**
 * Plugin options the server owner changes from /admin/features (public.feature_settings, key =
 * config.yml path). Same closed list and ranges as the plugin's FeatureSetting.java, which checks
 * every value again before applying it. An empty field means "what config.yml says".
 */

export type FeatureKind = "boolean" | "integer" | "decimal";
export type FeatureGroup = "purchases" | "express" | "orders";

type Def<K extends string> = { key: K; kind: FeatureKind; group: FeatureGroup; min: number; max: number };

const PRICE_MAX = 1_000_000_000;

export const FEATURES = [
  { key: "storage.buy.enabled", kind: "boolean", group: "purchases", min: 0, max: 0 },
  { key: "computer.buy.enabled", kind: "boolean", group: "purchases", min: 0, max: 0 },
  { key: "computer.buy.price", kind: "decimal", group: "purchases", min: 0, max: PRICE_MAX },
  { key: "computer.delivery.buy.enabled", kind: "boolean", group: "purchases", min: 0, max: 0 },
  { key: "computer.delivery.buy.price", kind: "decimal", group: "purchases", min: 0, max: PRICE_MAX },
  { key: "mailbox.buy.enabled", kind: "boolean", group: "purchases", min: 0, max: 0 },
  { key: "mailbox.buy.price", kind: "decimal", group: "purchases", min: 0, max: PRICE_MAX },
  { key: "mailbox.max-per-player", kind: "integer", group: "purchases", min: 0, max: 20 },
  { key: "mailbox.express.enabled", kind: "boolean", group: "express", min: 0, max: 0 },
  { key: "mailbox.express.fee", kind: "decimal", group: "express", min: 0, max: PRICE_MAX },
  { key: "mailbox.express.fee-to-seller", kind: "boolean", group: "express", min: 0, max: 0 },
  { key: "mailbox.express.hand-delivery", kind: "boolean", group: "express", min: 0, max: 0 },
  { key: "orders.automatic.delay-min-minutes", kind: "integer", group: "orders", min: 0, max: 1440 },
  { key: "orders.automatic.delay-max-minutes", kind: "integer", group: "orders", min: 0, max: 1440 },
  { key: "orders.roleplay.courier-max-percent", kind: "integer", group: "orders", min: 0, max: 100 },
] as const satisfies readonly Def<string>[];

export type FeatureKey = (typeof FEATURES)[number]["key"];
export type FeatureDef = Def<FeatureKey>;
export type FeatureValue = boolean | number;
export type FeatureValues = Partial<Record<FeatureKey, FeatureValue>>;
/** null deletes the override (back to config.yml). */
export type FeatureChange = { key: FeatureKey; value: string | null };

export const FEATURE_GROUPS: readonly FeatureGroup[] = ["purchases", "express", "orders"];

const DELAY_MIN: FeatureKey = "orders.automatic.delay-min-minutes";
const DELAY_MAX: FeatureKey = "orders.automatic.delay-max-minutes";

export function featureDef(key: FeatureKey): FeatureDef {
  const def = FEATURES.find((feature) => feature.key === key);
  if (!def) throw new Error(`Unknown feature ${key}`);
  return def;
}

export function isFeatureKey(key: string): key is FeatureKey {
  return FEATURES.some((feature) => feature.key === key);
}

/**
 * What the admin typed or chose → the text to store, null for "back to config.yml" (empty field),
 * or undefined when it is not a valid value for that option.
 */
export function parseFeatureInput(def: FeatureDef, raw: unknown): string | null | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const text = raw.trim().toLowerCase().replace(",", ".");
  if (def.kind === "boolean") return text === "true" || text === "false" ? text : undefined;
  const pattern = def.kind === "integer" ? /^\d+$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(text)) return undefined;
  const value = Number(text);
  return value >= def.min && value <= def.max ? String(value) : undefined;
}

export type FeatureFormResult =
  | { ok: true; changes: FeatureChange[] }
  | { ok: false; invalid: FeatureKey[]; delays: boolean };

/**
 * The whole panel at once: one change per option. The minimum automatic delay cannot end above the
 * maximum, counting the values in force ({@code published}) for the fields left empty.
 */
export function parseFeatureForm(get: (name: string) => unknown, published: FeatureValues): FeatureFormResult {
  const changes: FeatureChange[] = [];
  const invalid: FeatureKey[] = [];
  for (const def of FEATURES) {
    const value = parseFeatureInput(def, get(def.key));
    if (value === undefined) invalid.push(def.key);
    else changes.push({ key: def.key, value });
  }
  const inForce = (key: FeatureKey) => {
    const change = changes.find((entry) => entry.key === key)?.value;
    return change != null ? Number(change) : published[key];
  };
  const min = inForce(DELAY_MIN);
  const max = inForce(DELAY_MAX);
  const delays = typeof min === "number" && typeof max === "number" && min > max;
  return invalid.length > 0 || delays ? { ok: false, invalid, delays } : { ok: true, changes };
}

/**
 * Whether a stored override is not in force yet (the plugin applies it on its next refresh). Unknown
 * when the plugin never published its values: then it is not shown as pending.
 */
export function isFeaturePending(stored: string | undefined, inForce: FeatureValue | undefined): boolean {
  if (stored === undefined || inForce === undefined) return false;
  return typeof inForce === "boolean" ? stored !== String(inForce) : Number(stored) !== inForce;
}

/** plugin_settings.features (what the plugin has in force) → typed values; anything odd is dropped. */
export function parsePublishedFeatures(json: unknown): FeatureValues {
  if (typeof json !== "string") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  const values: FeatureValues = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!isFeatureKey(key)) continue;
    const kind = featureDef(key).kind;
    if (kind === "boolean" ? typeof value === "boolean" : typeof value === "number" && Number.isFinite(value)) {
      values[key] = value;
    }
  }
  return values;
}
