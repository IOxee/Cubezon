package es.fractalgamestudios.cubezon.order;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

/**
 * Moves the money of an order: buyer → seller. Main thread only (Vault). Never leaves money
 * half-moved without saying so: if the seller cannot be paid the buyer is refunded.
 */
public final class OrderPayment {

    /** The economy, reduced to what an order needs (Vault in the plugin, a fake in tests). */
    public interface Wallet {
        boolean has(UUID player, BigDecimal amount);

        boolean withdraw(UUID player, BigDecimal amount);

        boolean deposit(UUID player, BigDecimal amount);
    }

    private OrderPayment() {
    }

    /**
     * Automatic mode: the buyer pays the goods plus any express fee; the seller gets the goods (plus
     * the fee when {@code feeToSeller}). If the seller cannot be paid, the buyer gets everything back.
     *
     * @return empty when the order is paid, or why it is not
     */
    public static Optional<FailureReason> charge(Wallet wallet, ClaimedOrder order, boolean feeToSeller) {
        if (order.selfPurchase()) {
            return Optional.empty();
        }
        BigDecimal charged = order.charged();
        if (!wallet.has(order.buyerId(), charged)) {
            return Optional.of(FailureReason.INSUFFICIENT_FUNDS);
        }
        if (!wallet.withdraw(order.buyerId(), charged)) {
            return Optional.of(FailureReason.PAYMENT_ERROR);
        }
        if (wallet.deposit(order.sellerId(), order.sellerAmount(feeToSeller))) {
            return Optional.empty();
        }
        return Optional.of(wallet.deposit(order.buyerId(), charged)
                ? FailureReason.PAYOUT_FAILED
                : FailureReason.REFUND_FAILED);
    }

    /** Locker order without fee (kept for callers that do not deal with express orders). */
    public static Optional<FailureReason> charge(Wallet wallet, ClaimedOrder order) {
        return charge(wallet, order, false);
    }

    /**
     * Roleplay accept: only the buyer is charged (goods plus any express fee); the money is held
     * until delivery, when the seller is paid with {@link #pay}.
     *
     * @return empty when the buyer was charged (or it is a self purchase), or why not
     */
    public static Optional<FailureReason> chargeBuyer(Wallet wallet, ClaimedOrder order) {
        if (order.selfPurchase()) {
            return Optional.empty();
        }
        if (!wallet.has(order.buyerId(), order.charged())) {
            return Optional.of(FailureReason.INSUFFICIENT_FUNDS);
        }
        return wallet.withdraw(order.buyerId(), order.charged())
                ? Optional.empty()
                : Optional.of(FailureReason.PAYMENT_ERROR);
    }

    /** Pays held money out (seller on delivery, buyer on refund). Nothing moves for self purchases. */
    public static boolean pay(Wallet wallet, UUID player, BigDecimal amount, boolean selfPurchase) {
        return selfPurchase || wallet.deposit(player, amount);
    }
}
