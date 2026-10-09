package es.fractalgamestudios.cubezon.deposit;

import es.fractalgamestudios.cubezon.deposit.DepositRules.Split;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DepositRulesTest {

    @Test
    void fullStackSplitsIntoSeveralUnits() {
        assertEquals(new Split(4, 0), DepositRules.split(64, 16));
    }

    @Test
    void leftoverThatDoesNotFormAUnitIsReturned() {
        assertEquals(new Split(2, 8), DepositRules.split(40, 16));
        assertEquals(new Split(0, 15), DepositRules.split(15, 16));
    }

    @Test
    void looseItemsAddUpToAUnit() {
        // 10 + 6 identical diamonds are counted together before splitting.
        assertEquals(new Split(1, 0), DepositRules.split(10 + 6, 16));
    }

    @Test
    void unitsOfOneItem() {
        assertEquals(new Split(36, 0), DepositRules.split(36, 1));
    }

    @Test
    void invalidUnitAmountIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> DepositRules.split(10, 0));
    }

    @Test
    void itemKeyMustMatchExactly() {
        assertTrue(DepositRules.matchesKey("minecraft:diamond", "minecraft:diamond"));
        assertFalse(DepositRules.matchesKey("minecraft:diamond", "minecraft:diamond_block"));
        // A custom ruby built on paper is not paper, and plain paper is not a ruby.
        assertFalse(DepositRules.matchesKey("minecraft:paper", "itemsadder:myitems:ruby"));
        assertFalse(DepositRules.matchesKey("itemsadder:myitems:ruby", "minecraft:paper"));
    }

    @Test
    void unitMustFitInOneStack() {
        assertTrue(DepositRules.unitFitsInOneStack(16, 64));
        assertTrue(DepositRules.unitFitsInOneStack(1, 1));
        assertFalse(DepositRules.unitFitsInOneStack(2, 1));   // 2 swords per unit
        assertFalse(DepositRules.unitFitsInOneStack(32, 16)); // ender pearls stack to 16
    }
}
