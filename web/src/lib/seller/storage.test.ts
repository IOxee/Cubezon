import { describe, expect, it } from "vitest";
import { storageFillPercent, storageState, zoneFromColumns, type ShopZone, type ZoneColumns } from "./storage";

const NO_ZONE: ZoneColumns = {
  zone_world: null,
  zone_min_x: null,
  zone_min_y: null,
  zone_min_z: null,
  zone_max_x: null,
  zone_max_y: null,
  zone_max_z: null,
};

const ZONE: ShopZone = { world: "world", minX: -10, minY: 60, minZ: 5, maxX: 4, maxY: 80, maxZ: 20 };

describe("zoneFromColumns", () => {
  it("returns null until an admin sets the zone", () => {
    expect(zoneFromColumns(NO_ZONE)).toBeNull();
    expect(zoneFromColumns({ ...NO_ZONE, zone_world: "world" })).toBeNull();
  });

  it("maps the zone columns", () => {
    expect(
      zoneFromColumns({
        zone_world: "world",
        zone_min_x: -10,
        zone_min_y: 60,
        zone_min_z: 5,
        zone_max_x: 4,
        zone_max_y: 80,
        zone_max_z: 20,
      }),
    ).toEqual(ZONE);
  });
});

describe("storageState", () => {
  it("asks for a zone first", () => {
    expect(storageState(null, { blocks: 2, capacity: 54, used: 0 })).toBe("noZone");
  });

  it("asks for storage blocks when the zone has none", () => {
    expect(storageState(ZONE, { blocks: 0, capacity: 0, used: 0 })).toBe("noBlocks");
    expect(storageState(ZONE, { blocks: 0, capacity: 0, used: 3 })).toBe("noBlocks");
  });

  it("is full at capacity or above it (blocks removed)", () => {
    expect(storageState(ZONE, { blocks: 1, capacity: 27, used: 27 })).toBe("full");
    expect(storageState(ZONE, { blocks: 1, capacity: 27, used: 40 })).toBe("full");
    expect(storageState(ZONE, { blocks: 1, capacity: 27, used: 26 })).toBe("ok");
  });
});

describe("storageFillPercent", () => {
  it("rounds and caps the share in use", () => {
    expect(storageFillPercent({ blocks: 2, capacity: 54, used: 0 })).toBe(0);
    expect(storageFillPercent({ blocks: 2, capacity: 54, used: 18 })).toBe(33);
    expect(storageFillPercent({ blocks: 1, capacity: 27, used: 40 })).toBe(100);
  });

  it("handles a shop without capacity", () => {
    expect(storageFillPercent({ blocks: 0, capacity: 0, used: 0 })).toBe(0);
    expect(storageFillPercent({ blocks: 0, capacity: 0, used: 5 })).toBe(100);
  });
});
