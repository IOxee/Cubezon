package es.fractalgamestudios.cubezon.order;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * What a shop pays the employee who carries a package (roleplay), chosen per shop
 * ({@code shops.courier_commission_mode/value}). It comes out of the seller's payout and is capped by
 * the server ({@code orders.roleplay.courier-max-percent} of that payout).
 */
public record CourierCommission(Mode mode, BigDecimal value) {

    public enum Mode {
        NONE, PERCENT_TOTAL, PERCENT_EXPRESS, FIXED;

        public boolean percent() {
            return this == PERCENT_TOTAL || this == PERCENT_EXPRESS;
        }

        public static Mode parse(@Nullable String raw) {
            if (raw == null) {
                return NONE;
            }
            try {
                return valueOf(raw.strip().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return NONE;
            }
        }
    }

    public static final CourierCommission NONE = new CourierCommission(Mode.NONE, BigDecimal.ZERO);

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public CourierCommission {
        Objects.requireNonNull(mode, "mode");
        if (!valid(mode, value)) {
            throw new IllegalArgumentException("Invalid courier commission: " + mode + " " + value);
        }
    }

    /** From the shop's columns; anything invalid counts as no commission. */
    public static CourierCommission of(@Nullable String mode, @Nullable BigDecimal value) {
        Mode parsed = Mode.parse(mode);
        return valid(parsed, value) ? new CourierCommission(parsed, value) : NONE;
    }

    /** Percentages go from 0 to 100; a fixed amount is any amount from 0 up. */
    public static boolean valid(Mode mode, @Nullable BigDecimal value) {
        return value != null && value.signum() >= 0 && (!mode.percent() || value.compareTo(HUNDRED) <= 0);
    }

    /**
     * The courier's share of one order, rounded down to cents and never more than {@code maxPercent}
     * (clamped to 0-100) of the goods ({@code total}). The seller always gets at least the goods, so
     * what is left for them never drops below zero, whatever mailbox.express.fee-to-seller says.
     */
    public BigDecimal amountFor(BigDecimal total, BigDecimal expressFee, int maxPercent) {
        BigDecimal raw = switch (mode) {
            case NONE -> BigDecimal.ZERO;
            case PERCENT_TOTAL -> total.multiply(value).divide(HUNDRED);
            case PERCENT_EXPRESS -> expressFee.multiply(value).divide(HUNDRED);
            case FIXED -> value;
        };
        BigDecimal cap = total.multiply(BigDecimal.valueOf(Math.clamp(maxPercent, 0, 100))).divide(HUNDRED);
        return raw.min(cap).max(BigDecimal.ZERO).setScale(2, RoundingMode.DOWN);
    }

    /**
     * Whether whoever delivered the package earns the commission: an employee allowed to carry packages
     * (orders.package), even when they bought it themselves (the shop set what it pays). Never the
     * owner (who already gets the sale) and never on a self purchase (no money moves).
     */
    public static boolean paysCourier(ClaimedOrder order, UUID courierId, boolean mayCarryPackages) {
        return mayCarryPackages && !order.selfPurchase() && !courierId.equals(order.sellerId());
    }
}
