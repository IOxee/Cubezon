package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShopZoneTest {

    private static final UUID SHOP = UUID.randomUUID();
    private static final UUID OWNER = UUID.randomUUID();

    private static ShopZone zone(BlockPosition a, BlockPosition b) {
        return ShopZone.of(SHOP, OWNER, "Tienda", "tienda", a, b);
    }

    @Test
    void cornersInAnyOrderGiveTheSameZone() {
        ShopZone zone = zone(new BlockPosition("world", 10, 80, -5), new BlockPosition("world", 0, 60, 5));

        assertEquals(0, zone.minX());
        assertEquals(60, zone.minY());
        assertEquals(-5, zone.minZ());
        assertEquals(10, zone.maxX());
        assertEquals(80, zone.maxY());
        assertEquals(5, zone.maxZ());
        assertEquals(11, zone.sizeX());
    }

    @Test
    void bordersAreInsideTheZone() {
        ShopZone zone = zone(new BlockPosition("world", 0, 60, 0), new BlockPosition("world", 10, 80, 10));

        assertTrue(zone.contains(new BlockPosition("world", 0, 60, 0)));
        assertTrue(zone.contains(new BlockPosition("world", 10, 80, 10)));
        assertFalse(zone.contains(new BlockPosition("world", 11, 70, 5)));
        assertFalse(zone.contains(new BlockPosition("world", 5, 81, 5)));
        assertFalse(zone.contains(new BlockPosition("world_nether", 5, 70, 5)));
    }

    @Test
    void cornersMustBeInTheSameWorld() {
        assertThrows(IllegalArgumentException.class,
                () -> zone(new BlockPosition("world", 0, 0, 0), new BlockPosition("world_nether", 1, 1, 1)));
    }

    @Test
    void storageTypeIdsFollowTheDatabaseRule() {
        assertTrue(StorageType.isValidId("barrel"));
        assertTrue(StorageType.isValidId("camara-acorazada_2"));
        assertFalse(StorageType.isValidId("x"));
        assertFalse(StorageType.isValidId("Barril"));
        assertFalse(StorageType.isValidId("barril grande"));
    }

    @Test
    void registryFindsZoneAndBlocks() {
        StorageRegistry registry = new StorageRegistry();
        ShopZone zone = zone(new BlockPosition("world", 0, 60, 0), new BlockPosition("world", 10, 80, 10));
        BlockPosition inside = new BlockPosition("world", 5, 64, 5);
        StorageBlock block = new StorageBlock(UUID.randomUUID(), SHOP, "Tienda", inside, 27, StorageType.DEFAULT_ID);

        registry.replaceAll(List.of(zone), List.of(block));

        assertEquals(zone, registry.zoneAt(inside).orElseThrow());
        assertTrue(registry.zoneAt(new BlockPosition("world", 50, 64, 50)).isEmpty());
        assertEquals(zone, registry.zoneOf(SHOP).orElseThrow());
        assertEquals(block, registry.blockAt(inside));

        registry.removeBlock(block.id());
        assertNull(registry.blockAt(inside));
    }
}
