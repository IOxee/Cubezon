package es.fractalgamestudios.cubezon.order;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderPaymentTest {

    private static final UUID BUYER = UUID.randomUUID();
    private static final UUID SELLER = UUID.randomUUID();
    private static final BigDecimal TOTAL = new BigDecimal("500.00");

    /** In-memory economy; deposits to {@code brokenAccount} fail. */
    private static class FakeWallet implements OrderPayment.Wallet {
        final Map<UUID, BigDecimal> balances = new HashMap<>();
        UUID brokenAccount;
        int calls;

        @Override
        public boolean has(UUID player, BigDecimal amount) {
            calls++;
            return balance(player).compareTo(amount) >= 0;
        }

        @Override
        public boolean withdraw(UUID player, BigDecimal amount) {
            calls++;
            if (balance(player).compareTo(amount) < 0) {
                return false;
            }
            balances.put(player, balance(player).subtract(amount));
            return true;
        }

        @Override
        public boolean deposit(UUID player, BigDecimal amount) {
            calls++;
            if (player.equals(brokenAccount)) {
                return false;
            }
            balances.put(player, balance(player).add(amount));
            return true;
        }

        BigDecimal balance(UUID player) {
            return balances.getOrDefault(player, BigDecimal.ZERO);
        }
    }

    private static ClaimedOrder order(UUID buyer, UUID seller) {
        return new ClaimedOrder(UUID.randomUUID(), buyer, seller, UUID.randomUUID(),
                "Espada", "Tienda", "Spawn", 2, TOTAL);
    }

    @Test
    void movesTheMoneyFromBuyerToSeller() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("800"));

        assertEquals(Optional.empty(), OrderPayment.charge(wallet, order(BUYER, SELLER)));
        assertEquals(0, new BigDecimal("300").compareTo(wallet.balance(BUYER)));
        assertEquals(0, TOTAL.compareTo(wallet.balance(SELLER)));
    }

    @Test
    void buyerWithoutEnoughMoneyIsNotCharged() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("499.99"));

        assertEquals(Optional.of(FailureReason.INSUFFICIENT_FUNDS), OrderPayment.charge(wallet, order(BUYER, SELLER)));
        assertEquals(0, new BigDecimal("499.99").compareTo(wallet.balance(BUYER)));
        assertEquals(0, BigDecimal.ZERO.compareTo(wallet.balance(SELLER)));
    }

    @Test
    void failedPayoutRefundsTheBuyer() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("800"));
        wallet.brokenAccount = SELLER;

        assertEquals(Optional.of(FailureReason.PAYOUT_FAILED), OrderPayment.charge(wallet, order(BUYER, SELLER)));
        assertEquals(0, new BigDecimal("800").compareTo(wallet.balance(BUYER)));
        assertEquals("REFUNDED", FailureReason.PAYOUT_FAILED.status());
    }

    @Test
    void failedRefundIsReported() {
        var wallet = new FakeWallet() {
            @Override
            public boolean deposit(UUID player, BigDecimal amount) {
                calls++;
                return false;
            }
        };
        wallet.balances.put(BUYER, new BigDecimal("800"));

        assertEquals(Optional.of(FailureReason.REFUND_FAILED), OrderPayment.charge(wallet, order(BUYER, SELLER)));
        assertEquals("FAILED", FailureReason.REFUND_FAILED.status());
    }

    private static ClaimedOrder express(BigDecimal fee) {
        return new ClaimedOrder(UUID.randomUUID(), BUYER, SELLER, UUID.randomUUID(), "Espada", "Tienda", "", 2, TOTAL,
                fee, UUID.randomUUID());
    }

    @Test
    void expressFeeIsChargedToTheBuyerAndKeptByTheServer() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("1000"));

        assertEquals(Optional.empty(), OrderPayment.charge(wallet, express(new BigDecimal("100")), false));
        assertEquals(0, new BigDecimal("400").compareTo(wallet.balance(BUYER)));   // 1000 - 500 - 100
        assertEquals(0, TOTAL.compareTo(wallet.balance(SELLER)));                   // only the goods
    }

    @Test
    void expressFeeCanGoToTheSeller() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("1000"));

        assertEquals(Optional.empty(), OrderPayment.charge(wallet, express(new BigDecimal("100")), true));
        assertEquals(0, new BigDecimal("600").compareTo(wallet.balance(SELLER)));
    }

    @Test
    void buyerWhoCannotPayTheFeeIsNotCharged() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("550"));

        assertEquals(Optional.of(FailureReason.INSUFFICIENT_FUNDS), OrderPayment.charge(wallet, express(new BigDecimal("100")), false));
        assertEquals(0, new BigDecimal("550").compareTo(wallet.balance(BUYER)));
    }

    @Test
    void failedPayoutRefundsTheFeeToo() {
        var wallet = new FakeWallet();
        wallet.balances.put(BUYER, new BigDecimal("1000"));
        wallet.brokenAccount = SELLER;

        assertEquals(Optional.of(FailureReason.PAYOUT_FAILED), OrderPayment.charge(wallet, express(new BigDecimal("100")), false));
        assertEquals(0, new BigDecimal("1000").compareTo(wallet.balance(BUYER)));
    }

    @Test
    void selfPurchaseMovesNoMoney() {
        var wallet = new FakeWallet();

        assertEquals(Optional.empty(), OrderPayment.charge(wallet, order(BUYER, BUYER)));
        assertEquals(0, wallet.calls);
    }
}
