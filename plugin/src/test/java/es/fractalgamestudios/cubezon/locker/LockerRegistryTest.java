package es.fractalgamestudios.cubezon.locker;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LockerRegistryTest {

    private static final Locker SPAWN = locker("Spawn", "world", 0, 64, 0);
    private static final Locker MARKET = locker("Mercado", "world", 10, 64, 0);
    private static final Locker NETHER = locker("Nether", "world_nether", 0, 64, 0);

    private final LockerRegistry registry = new LockerRegistry();

    @Test
    void findsLockerByExactBlock() {
        registry.replaceAll(List.of(SPAWN, MARKET));

        assertEquals(SPAWN, registry.at(new BlockPosition("world", 0, 64, 0)));
        assertNull(registry.at(new BlockPosition("world", 0, 65, 0)));
    }

    @Test
    void nearestPicksTheClosestInTheSameWorldWithinRadius() {
        registry.replaceAll(List.of(SPAWN, MARKET, NETHER));

        assertEquals(MARKET, registry.nearest("world", 8.5, 64, 0.5, 5).orElseThrow());
        assertTrue(registry.nearest("world", 5.5, 64, 0.5, 2).isEmpty());
        assertEquals(NETHER, registry.nearest("world_nether", 1, 64, 1, 5).orElseThrow());
    }

    @Test
    void removeByNameIgnoresCase() {
        registry.replaceAll(List.of(SPAWN, MARKET));
        registry.remove("spawn");

        assertNull(registry.at(SPAWN.position()));
        assertEquals(List.of("Mercado"), registry.names());
    }

    private static Locker locker(String name, String world, int x, int y, int z) {
        return new Locker(UUID.randomUUID(), name, new BlockPosition(world, x, y, z), true);
    }
}
