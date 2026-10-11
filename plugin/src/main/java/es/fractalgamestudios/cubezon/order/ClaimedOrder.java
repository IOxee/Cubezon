package es.fractalgamestudios.cubezon.order;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A PENDING order the plugin has claimed, with what charging and notifying need.
 * {@code total} is the goods (unit_price * quantity); express orders also pay {@code expressFee}
 * and go to {@code mailboxId} instead of a locker. In roleplay, the employee who delivered it
 * ({@code courierId}) may earn {@code courierAmount}, taken out of the seller's payout.
 */
public record ClaimedOrder(
        UUID id,
        UUID buyerId,
        UUID sellerId,
        UUID listingId,
        String title,
        String shopName,
        String lockerName,
        int quantity,
        BigDecimal total,
        BigDecimal expressFee,
        @Nullable UUID mailboxId,
        @Nullable UUID courierId,
        BigDecimal courierAmount) {

    /** An order nobody has carried (yet). */
    public ClaimedOrder(UUID id, UUID buyerId, UUID sellerId, UUID listingId, String title, String shopName,
                        String lockerName, int quantity, BigDecimal total, BigDecimal expressFee, @Nullable UUID mailboxId) {
        this(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total, expressFee, mailboxId,
                null, BigDecimal.ZERO);
    }

    /** A locker order without express fee. */
    public ClaimedOrder(UUID id, UUID buyerId, UUID sellerId, UUID listingId, String title, String shopName,
                        String lockerName, int quantity, BigDecimal total) {
        this(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total, BigDecimal.ZERO, null);
    }

    /** The same order once an employee earned {@code amount} for carrying it. */
    public ClaimedOrder withCourier(UUID courier, BigDecimal amount) {
        return new ClaimedOrder(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total,
                expressFee, mailboxId, courier, amount);
    }

    /** Buying from your own shop (allowed in development): no money moves. */
    public boolean selfPurchase() {
        return buyerId.equals(sellerId);
    }

    /** Express delivery straight to the buyer's mailbox. */
    public boolean toMailbox() {
        return mailboxId != null;
    }

    /** Someone other than the seller is owed a courier commission. */
    public boolean paysCourier() {
        return courierId != null && courierAmount.signum() > 0;
    }

    /** What the buyer pays: the goods plus the express fee. */
    public BigDecimal charged() {
        return total.add(expressFee);
    }

    /** What the seller gets: the goods (plus the express fee if config.yml gives it to them), minus the courier's share. */
    public BigDecimal sellerAmount(boolean feeToSeller) {
        return (feeToSeller ? charged() : total).subtract(courierAmount);
    }
}
