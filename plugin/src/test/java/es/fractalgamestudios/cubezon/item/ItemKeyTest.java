package es.fractalgamestudios.cubezon.item;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ItemKeyTest {

    @Test
    void keysOfEverySourceMatchTheDatabaseFormat() {
        assertTrue(ItemIdentity.isValidKey("minecraft:diamond"));
        assertTrue(ItemIdentity.isValidKey("create:wrench"));
        assertTrue(ItemIdentity.isValidKey("itemsadder:myitems:ruby"));
        assertTrue(ItemIdentity.isValidKey("mmoitems:SWORD:FIRE_SWORD"));
        assertTrue(ItemIdentity.isValidKey("slimefun:ELECTRIC_MOTOR"));
        assertTrue(ItemIdentity.isValidKey("nexo:ruby_sword"));
        assertTrue(ItemIdentity.isValidKey("craftengine:default:topaz"));
        assertTrue(ItemIdentity.isValidKey("customjukebox:my_disc"));
    }

    @Test
    void malformedKeysAreRejected() {
        assertFalse(ItemIdentity.isValidKey("diamond"));
        assertFalse(ItemIdentity.isValidKey("Nexo:ruby"));
        assertFalse(ItemIdentity.isValidKey("nexo:"));
        assertFalse(ItemIdentity.isValidKey("nexo:ruby sword"));
    }

    @Test
    void onlyMinecraftKeysAreVanilla() {
        assertFalse(new ItemKey("minecraft:diamond", "vanilla", "diamond").custom());
        assertTrue(new ItemKey("create:wrench", "mod", "barrier").custom());
        assertTrue(new ItemKey("nexo:ruby", "pdc:nexo:id", "paper").custom());
    }
}
