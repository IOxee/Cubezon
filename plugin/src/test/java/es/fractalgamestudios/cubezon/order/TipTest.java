package es.fractalgamestudios.cubezon.order;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The buyer's tip: charged with the order, paid to whoever delivers it, or to the shop when nobody does. */
class TipTest {

    private static final UUID BUYER = UUID.randomUUID();
    private static final UUID OWNER = UUID.randomUUID();
    private static final UUID COURIER = UUID.randomUUID();

    private static ClaimedOrder order(String tip) {
        return new ClaimedOrder(UUID.randomUUID(), BUYER, OWNER, UUID.randomUUID(), "Espada", "Tienda", "", 1,
                new BigDecimal("400.00"), new BigDecimal("50.00"), UUID.randomUUID(), null, BigDecimal.ZERO,
                new BigDecimal(tip));
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    @Test
    void theBuyerPaysTheTipOnTop() {
        assertMoney("475.00", order("25.00").charged());
    }

    @Test
    void withoutACourierTheShopKeepsTheTip() {
        ClaimedOrder order = order("25.00");

        assertMoney("425.00", order.sellerAmount(false));
        assertFalse(order.paysCourier());
    }

    @Test
    void theCourierGetsCommissionAndTipAndTheSellerNeither() {
        ClaimedOrder delivered = order("25.00").withCourier(COURIER, new BigDecimal("40.00"));

        assertMoney("65.00", delivered.courierPayout());
        assertMoney("360.00", delivered.sellerAmount(false));
        assertTrue(delivered.paysCourier());
    }

    @Test
    void aTipAloneIsWorthPayingTheCourier() {
        ClaimedOrder delivered = order("10.00").withCourier(COURIER, BigDecimal.ZERO);

        assertTrue(delivered.paysCourier());
        assertMoney("10.00", delivered.courierPayout());
        assertMoney("400.00", delivered.sellerAmount(false));
    }

    @Test
    void aTipAboveTheServerMaximumIsRefused() {
        assertTrue(order("25.00").tipWithin(new BigDecimal("25")));
        assertFalse(order("25.01").tipWithin(new BigDecimal("25")));
        assertFalse(order("1.00").tipWithin(BigDecimal.ZERO), "tips switched off allow none");
        assertTrue(order("0").tipWithin(BigDecimal.ZERO));
    }

    @Test
    void anInvalidTipFailsTheOrderWithoutCharging() {
        assertEquals("FAILED", FailureReason.INVALID_TIP.status());
    }

    @Test
    void ordersBuiltWithoutATipHaveNone() {
        ClaimedOrder plain = new ClaimedOrder(UUID.randomUUID(), BUYER, OWNER, UUID.randomUUID(), "Espada", "Tienda",
                "Spawn", 1, new BigDecimal("400.00"));

        assertMoney("0", plain.tip());
        assertMoney("400.00", plain.charged());
    }
}
