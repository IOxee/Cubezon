package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.roleplay.ComputerKind.Placement;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ComputerKindTest {

    private static final UUID SHOP = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    @Test
    void fullComputerOnlyGoesInsideAZone() {
        assertEquals(Placement.OK, ComputerKind.FULL.placement(SHOP, null));
        assertEquals(Placement.OUTSIDE_ZONE, ComputerKind.FULL.placement(null, null));
    }

    @Test
    void deliveryTerminalGoesAnywhereButAnotherShopsZone() {
        assertEquals(Placement.OK, ComputerKind.DELIVERY.placement(null, SHOP));
        assertEquals(Placement.OK, ComputerKind.DELIVERY.placement(SHOP, SHOP));
        assertEquals(Placement.OTHER_SHOP_ZONE, ComputerKind.DELIVERY.placement(OTHER, SHOP));
    }

    @Test
    void deliveryTerminalWithoutItsShopCannotBePlaced() {
        assertEquals(Placement.NOT_BOUND, ComputerKind.DELIVERY.placement(null, null));
    }

    @Test
    void onlyTheFullComputerManagesTheShop() {
        assertTrue(ComputerKind.FULL.managesShop());
        assertFalse(ComputerKind.DELIVERY.managesShop());
    }

    @Test
    void unknownKindIsFull() {
        assertEquals(ComputerKind.DELIVERY, ComputerKind.parse("delivery"));
        assertEquals(ComputerKind.FULL, ComputerKind.parse("whatever"));
        assertEquals(ComputerKind.FULL, ComputerKind.parse(null));
    }
}
