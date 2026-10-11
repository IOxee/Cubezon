package es.fractalgamestudios.cubezon.order;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A PENDING order the plugin has claimed, with what charging and notifying need.
 * {@code total} is the goods (unit_price * quantity); express orders also pay {@code expressFee}
 * and go to {@code mailboxId} instead of a locker, and the buyer may add a {@code tip}. In roleplay,
 * the employee who delivered it ({@code courierId}) may earn {@code courierAmount}, taken out of the
 * seller's payout, and gets the tip; without a courier the tip goes to the seller.
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
        BigDecimal courierAmount,
        BigDecimal tip) {

    /** An order nobody has carried (yet). */
    public ClaimedOrder(UUID id, UUID buyerId, UUID sellerId, UUID listingId, String title, String shopName,
                        String lockerName, int quantity, BigDecimal total, BigDecimal expressFee, @Nullable UUID mailboxId,
                        BigDecimal tip) {
        this(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total, expressFee, mailboxId,
                null, BigDecimal.ZERO, tip);
    }

    /** An order without tip that nobody has carried (yet). */
    public ClaimedOrder(UUID id, UUID buyerId, UUID sellerId, UUID listingId, String title, String shopName,
                        String lockerName, int quantity, BigDecimal total, BigDecimal expressFee, @Nullable UUID mailboxId) {
        this(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total, expressFee, mailboxId,
                BigDecimal.ZERO);
    }

    /** A locker order without express fee nor tip. */
    public ClaimedOrder(UUID id, UUID buyerId, UUID sellerId, UUID listingId, String title, String shopName,
                        String lockerName, int quantity, BigDecimal total) {
        this(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total, BigDecimal.ZERO, null);
    }

    /** The same order once an employee delivered it, earning {@code commission} (and the tip). */
    public ClaimedOrder withCourier(UUID courier, BigDecimal commission) {
        return new ClaimedOrder(id, buyerId, sellerId, listingId, title, shopName, lockerName, quantity, total,
                expressFee, mailboxId, courier, commission, tip);
    }

    /** Buying from your own shop (allowed in development): no money moves. */
    public boolean selfPurchase() {
        return buyerId.equals(sellerId);
    }

    /** Express delivery straight to the buyer's mailbox. */
    public boolean toMailbox() {
        return mailboxId != null;
    }

    /** What the courier is owed: their commission plus the tip; nothing without a courier. */
    public BigDecimal courierPayout() {
        return courierId == null ? BigDecimal.ZERO : courierAmount.add(tip);
    }

    /** Someone other than the seller is owed money for carrying the order. */
    public boolean paysCourier() {
        return courierPayout().signum() > 0;
    }

    /** The tip is within the server's maximum (0 when tips are off). Checked before charging. */
    public boolean tipWithin(BigDecimal maxTip) {
        return tip.compareTo(maxTip) <= 0;
    }

    /** What the buyer pays: the goods, the express fee and the tip. */
    public BigDecimal charged() {
        return total.add(expressFee).add(tip);
    }

    /**
     * What the seller gets: the goods (plus the express fee if config.yml gives it to them), minus the
     * courier's commission, plus the tip when no courier earned it.
     */
    public BigDecimal sellerAmount(boolean feeToSeller) {
        BigDecimal goods = feeToSeller ? total.add(expressFee) : total;
        return goods.subtract(courierAmount).add(courierId == null ? tip : BigDecimal.ZERO);
    }
}
