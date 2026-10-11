package es.fractalgamestudios.cubezon.kiosk;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KioskRegistryTest {

    private static final BlockPosition SPAWN = new BlockPosition("world", 0, 64, 0);
    private static final BlockPosition MARKET = new BlockPosition("world", 10, 64, -3);

    @Test
    void knowsWhichBlocksAreKiosks() {
        var registry = new KioskRegistry();
        registry.replaceAll(List.of(SPAWN));

        assertTrue(registry.contains(SPAWN));
        assertFalse(registry.contains(MARKET));
    }

    @Test
    void addAndRemoveKeepTheRestAndListInOrder() {
        var registry = new KioskRegistry();
        registry.add(MARKET);
        registry.add(SPAWN);
        registry.remove(MARKET);

        assertEquals(List.of(SPAWN), registry.all());
    }

    @Test
    void replaceAllDropsWhatIsNoLongerThere() {
        var registry = new KioskRegistry();
        registry.add(SPAWN);
        registry.replaceAll(List.of(MARKET));

        assertFalse(registry.contains(SPAWN));
        assertTrue(registry.contains(MARKET));
    }
}
