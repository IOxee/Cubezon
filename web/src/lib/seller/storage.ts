/**
 * Pure helpers for a shop's storage. Deposits are capped by the "Almacén Cubezon" blocks placed
 * inside the shop's zone (a cuboid an admin sets in the game): units in escrow (AVAILABLE +
 * RESERVED) can never go over their summed capacity.
 */

export type ShopZone = {
  world: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

export type ZoneColumns = {
  zone_world: string | null;
  zone_min_x: number | null;
  zone_min_y: number | null;
  zone_min_z: number | null;
  zone_max_x: number | null;
  zone_max_y: number | null;
  zone_max_z: number | null;
};

/** The shop's zone, or null while an admin has not set it (the columns are all null or all set). */
export function zoneFromColumns(row: ZoneColumns): ShopZone | null {
  const { zone_world: world, zone_min_x: minX, zone_min_y: minY, zone_min_z: minZ } = row;
  const { zone_max_x: maxX, zone_max_y: maxY, zone_max_z: maxZ } = row;
  if (world === null || minX === null || minY === null || minZ === null) return null;
  if (maxX === null || maxY === null || maxZ === null) return null;
  return { world, minX, minY, minZ, maxX, maxY, maxZ };
}

/** Storage of a shop: placed blocks, units they can hold and units held now. */
export type StorageFigures = { blocks: number; capacity: number; used: number };

export const EMPTY_STORAGE: StorageFigures = { blocks: 0, capacity: 0, used: 0 };

/**
 * What the seller has to do before depositing: get a zone (ask an admin), place storage blocks
 * in it, or make room (it is full: selling still works, depositing does not).
 */
export type StorageState = "noZone" | "noBlocks" | "full" | "ok";

export function storageState(zone: ShopZone | null, storage: StorageFigures): StorageState {
  if (!zone) return "noZone";
  if (storage.blocks === 0 || storage.capacity <= 0) return "noBlocks";
  if (storage.used >= storage.capacity) return "full";
  return "ok";
}

/** Share of the capacity in use, 0 to 100 (100 when over capacity because blocks were removed). */
export function storageFillPercent({ capacity, used }: StorageFigures): number {
  if (capacity <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((used / capacity) * 100)));
}
