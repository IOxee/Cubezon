package es.fractalgamestudios.cubezon.mailbox;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExpressPricingTest {

    private static final BigDecimal SERVER = new BigDecimal("100");
    private static final BigDecimal MAX = new BigDecimal("150");

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    @Test
    void serverPricingIgnoresWhatShopsSet() {
        assertMoney("100", ExpressPricing.SERVER.feeFor(SERVER, MAX, new BigDecimal("20")));
        assertFalse(ExpressPricing.SERVER.shopsSetFee());
    }

    @Test
    void shopPricingUsesTheShopsFeeOrTheServersWhenItHasNone() {
        assertMoney("20", ExpressPricing.SHOP.feeFor(SERVER, MAX, new BigDecimal("20")));
        assertMoney("900", ExpressPricing.SHOP.feeFor(SERVER, MAX, new BigDecimal("900")));
        assertMoney("100", ExpressPricing.SHOP.feeFor(SERVER, MAX, null));
    }

    @Test
    void cappedPricingNeverGoesAboveTheServerCap() {
        assertMoney("150", ExpressPricing.SHOP_CAPPED.feeFor(SERVER, MAX, new BigDecimal("900")));
        assertMoney("20", ExpressPricing.SHOP_CAPPED.feeFor(SERVER, MAX, new BigDecimal("20")));
        assertMoney("100", ExpressPricing.SHOP_CAPPED.feeFor(SERVER, MAX, null));
    }

    @Test
    void aShopFeeIsValidWithinTheCapOnly() {
        assertTrue(ExpressPricing.SHOP.accepts(new BigDecimal("900"), MAX));
        assertTrue(ExpressPricing.SHOP_CAPPED.accepts(new BigDecimal("150"), MAX));
        assertFalse(ExpressPricing.SHOP_CAPPED.accepts(new BigDecimal("150.01"), MAX));
        assertFalse(ExpressPricing.SHOP.accepts(new BigDecimal("-1"), MAX));
        assertFalse(ExpressPricing.SERVER.accepts(new BigDecimal("10"), MAX));
    }

    @Test
    void parsesTheConfigNames() {
        assertEquals(ExpressPricing.SHOP_CAPPED, ExpressPricing.parse("shop-capped"));
        assertEquals(ExpressPricing.SHOP, ExpressPricing.parse(" Shop "));
        assertEquals(ExpressPricing.SERVER, ExpressPricing.parse("whatever"));
        assertEquals("shop-capped", ExpressPricing.SHOP_CAPPED.key());
    }
}
