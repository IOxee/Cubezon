package es.fractalgamestudios.cubezon.order;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoleplayPaymentTest {

    private static final UUID BUYER = UUID.randomUUID();
    private static final UUID SELLER = UUID.randomUUID();
    private static final BigDecimal TOTAL = new BigDecimal("400.00");

    private static final class Wallet implements OrderPayment.Wallet {
        final Map<UUID, BigDecimal> balances = new HashMap<>();
        boolean depositsFail;

        @Override
        public boolean has(UUID player, BigDecimal amount) {
            return balance(player).compareTo(amount) >= 0;
        }

        @Override
        public boolean withdraw(UUID player, BigDecimal amount) {
            if (!has(player, amount)) {
                return false;
            }
            balances.put(player, balance(player).subtract(amount));
            return true;
        }

        @Override
        public boolean deposit(UUID player, BigDecimal amount) {
            if (depositsFail) {
                return false;
            }
            balances.put(player, balance(player).add(amount));
            return true;
        }

        BigDecimal balance(UUID player) {
            return balances.getOrDefault(player, BigDecimal.ZERO);
        }
    }

    private static ClaimedOrder order(UUID seller) {
        return new ClaimedOrder(UUID.randomUUID(), BUYER, seller, UUID.randomUUID(), "Espada", "Tienda", "Spawn", 1, TOTAL);
    }

    @Test
    void acceptChargesOnlyTheBuyerAndHoldsTheMoney() {
        var wallet = new Wallet();
        wallet.balances.put(BUYER, new BigDecimal("1000"));

        assertEquals(Optional.empty(), OrderPayment.chargeBuyer(wallet, order(SELLER)));
        assertEquals(0, new BigDecimal("600").compareTo(wallet.balance(BUYER)));
        assertEquals(0, BigDecimal.ZERO.compareTo(wallet.balance(SELLER)));
    }

    @Test
    void deliveryPaysTheSellerTheHeldMoney() {
        var wallet = new Wallet();

        assertTrue(OrderPayment.pay(wallet, SELLER, TOTAL, false));
        assertEquals(0, TOTAL.compareTo(wallet.balance(SELLER)));
    }

    @Test
    void acceptWithoutEnoughMoneyFails() {
        var wallet = new Wallet();
        wallet.balances.put(BUYER, new BigDecimal("10"));

        assertEquals(Optional.of(FailureReason.INSUFFICIENT_FUNDS), OrderPayment.chargeBuyer(wallet, order(SELLER)));
        assertEquals(0, new BigDecimal("10").compareTo(wallet.balance(BUYER)));
    }

    @Test
    void failedPayoutIsReportedSoItCanBeRetried() {
        var wallet = new Wallet();
        wallet.depositsFail = true;

        assertFalse(OrderPayment.pay(wallet, SELLER, TOTAL, false));
    }

    @Test
    void selfPurchaseMovesNoMoneyInEitherStep() {
        var wallet = new Wallet();
        wallet.depositsFail = true;

        assertEquals(Optional.empty(), OrderPayment.chargeBuyer(wallet, order(BUYER)));
        assertTrue(OrderPayment.pay(wallet, BUYER, TOTAL, true));
    }

    @Test
    void reasonsMapToTheirFinalStatus() {
        assertEquals("FAILED", FailureReason.SHOP_REJECTED.status());
        assertEquals("FAILED", FailureReason.EXPIRED.status());
        assertEquals("REFUNDED", FailureReason.DELIVERY_EXPIRED.status());
    }

    @Test
    void unknownModeFallsBackToAutomatic() {
        assertEquals(OrderMode.ROLEPLAY, OrderMode.parse(" Roleplay "));
        assertEquals(OrderMode.AUTOMATIC, OrderMode.parse("automatic"));
        assertEquals(OrderMode.AUTOMATIC, OrderMode.parse("whatever"));
        assertEquals(OrderMode.AUTOMATIC, OrderMode.parse(null));
    }
}
