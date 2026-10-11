package es.fractalgamestudios.cubezon.order;

import es.fractalgamestudios.cubezon.order.CourierCommission.Mode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CourierCommissionTest {

    private static final UUID BUYER = UUID.randomUUID();
    private static final UUID OWNER = UUID.randomUUID();
    private static final UUID EMPLOYEE = UUID.randomUUID();
    private static final BigDecimal TOTAL = new BigDecimal("400.00");
    private static final BigDecimal FEE = new BigDecimal("50.00");

    private static BigDecimal amount(Mode mode, String value, BigDecimal fee, int maxPercent) {
        return new CourierCommission(mode, new BigDecimal(value)).amountFor(TOTAL, fee, maxPercent);
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    private static ClaimedOrder order(UUID buyer) {
        return new ClaimedOrder(UUID.randomUUID(), buyer, OWNER, UUID.randomUUID(), "Espada", "Tienda", "", 1,
                TOTAL, FEE, UUID.randomUUID());
    }

    @Test
    void percentOfTotalIsTakenFromTheGoods() {
        assertMoney("40.00", amount(Mode.PERCENT_TOTAL, "10", FEE, 50));
    }

    @Test
    void percentOfExpressIsTakenFromTheFeeOnly() {
        assertMoney("10.00", amount(Mode.PERCENT_EXPRESS, "20", FEE, 50));
        assertMoney("0", amount(Mode.PERCENT_EXPRESS, "20", BigDecimal.ZERO, 50));
    }

    @Test
    void fixedAmountIsPaidAsIs() {
        assertMoney("25.00", amount(Mode.FIXED, "25", FEE, 50));
    }

    @Test
    void noneAndZeroPayNothing() {
        assertMoney("0", CourierCommission.NONE.amountFor(TOTAL, FEE, 50));
        assertMoney("0", amount(Mode.FIXED, "0", FEE, 50));
    }

    @Test
    void serverCapLimitsTheShareOfTheSellerPayout() {
        assertMoney("200.00", amount(Mode.FIXED, "300", FEE, 50));
        assertMoney("200.00", amount(Mode.PERCENT_TOTAL, "100", FEE, 50));
        assertMoney("0", amount(Mode.FIXED, "30", FEE, 0));
    }

    @Test
    void capOutsideZeroToHundredIsClamped() {
        assertMoney("400.00", amount(Mode.FIXED, "999", FEE, 250));
        assertMoney("0", amount(Mode.FIXED, "30", FEE, -5));
    }

    @Test
    void roundsDownToCents() {
        var commission = new CourierCommission(Mode.PERCENT_TOTAL, new BigDecimal("10"));
        assertMoney("3.33", commission.amountFor(new BigDecimal("33.33"), BigDecimal.ZERO, 50));
    }

    @Test
    void capIsOnTheGoodsSoTheSellerNeverEndsBelowZero() {
        ClaimedOrder order = order(BUYER);
        BigDecimal share = amount(Mode.FIXED, "5000", FEE, 100);

        assertMoney("400.00", share);
        assertMoney("0", order.withCourier(EMPLOYEE, share).sellerAmount(false));
        assertMoney("50.00", order.withCourier(EMPLOYEE, share).sellerAmount(true));
    }

    @Test
    void nothingToPayIsNotADeposit() {
        OrderPayment.Wallet failing = new OrderPayment.Wallet() {
            public boolean has(UUID player, BigDecimal amount) { return false; }
            public boolean withdraw(UUID player, BigDecimal amount) { return false; }
            public boolean deposit(UUID player, BigDecimal amount) { return false; }
        };

        assertTrue(OrderPayment.pay(failing, OWNER, BigDecimal.ZERO, false));
        assertFalse(OrderPayment.pay(failing, OWNER, BigDecimal.ONE, false));
    }

    @Test
    void percentAboveHundredOrNegativeValueIsRejected() {
        assertFalse(CourierCommission.valid(Mode.PERCENT_TOTAL, new BigDecimal("101")));
        assertFalse(CourierCommission.valid(Mode.FIXED, new BigDecimal("-1")));
        assertTrue(CourierCommission.valid(Mode.FIXED, new BigDecimal("1000")));
        assertThrows(IllegalArgumentException.class, () -> new CourierCommission(Mode.PERCENT_EXPRESS, new BigDecimal("150")));
    }

    @Test
    void unknownModeIsNone() {
        assertEquals(Mode.PERCENT_EXPRESS, Mode.parse("percent_express"));
        assertEquals(Mode.NONE, Mode.parse("whatever"));
        assertEquals(Mode.NONE, Mode.parse(null));
    }

    @Test
    void invalidStoredValuesMeanNoCommission() {
        assertEquals(new CourierCommission(Mode.FIXED, new BigDecimal("25")), CourierCommission.of("FIXED", new BigDecimal("25")));
        assertEquals(CourierCommission.NONE, CourierCommission.of("PERCENT_TOTAL", new BigDecimal("120")));
        assertEquals(CourierCommission.NONE, CourierCommission.of("FIXED", null));
    }

    @Test
    void onlyAnEmployeeWhoMayCarryPackagesEarnsIt() {
        assertTrue(CourierCommission.paysCourier(order(BUYER), EMPLOYEE, true));
        assertFalse(CourierCommission.paysCourier(order(BUYER), OWNER, true), "the owner already gets the sale");
        assertFalse(CourierCommission.paysCourier(order(BUYER), EMPLOYEE, false), "needs orders.package");
        assertFalse(CourierCommission.paysCourier(order(OWNER), EMPLOYEE, true), "self purchases move no money");
        assertTrue(CourierCommission.paysCourier(order(EMPLOYEE), EMPLOYEE, true),
                "an employee who carries their own order still did the delivery: the shop pays it");
    }

    @Test
    void courierShareComesOutOfTheSellerPayout() {
        ClaimedOrder delivered = order(BUYER).withCourier(EMPLOYEE, new BigDecimal("40.00"));

        assertMoney("360.00", delivered.sellerAmount(false));
        assertMoney("410.00", delivered.sellerAmount(true));
        assertMoney("450.00", delivered.charged());
        assertTrue(delivered.paysCourier());
        assertFalse(order(BUYER).paysCourier());
    }
}
