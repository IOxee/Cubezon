package es.fractalgamestudios.cubezon.order;

/**
 * Codes stored in orders.failure_reason (the web translates them). Each one also says which
 * final status the order gets.
 */
public enum FailureReason {
    OUT_OF_STOCK,
    LISTING_UNAVAILABLE,
    LOCKER_UNAVAILABLE,
    /** Express order whose mailbox no longer exists (nothing was charged). */
    MAILBOX_UNAVAILABLE,
    INVALID_ITEM,
    INSUFFICIENT_FUNDS,
    PAYMENT_ERROR,
    /** The plugin stopped between claiming and finishing: an admin must check the payment. */
    INTERRUPTED,
    /** The buyer was charged, the seller could not be paid and the buyer got the money back. */
    PAYOUT_FAILED,
    /** As PAYOUT_FAILED, but giving the money back also failed: an admin must fix it by hand. */
    REFUND_FAILED,
    /** Roleplay: the shop rejected the order (nothing was charged). */
    SHOP_REJECTED,
    /** Roleplay: the shop did not answer in time (nothing was charged). */
    EXPIRED,
    /** Roleplay: accepted (charged) but never delivered in time; the buyer is refunded. */
    DELIVERY_EXPIRED;

    public String status() {
        return this == PAYOUT_FAILED || this == DELIVERY_EXPIRED ? "REFUNDED" : "FAILED";
    }
}
