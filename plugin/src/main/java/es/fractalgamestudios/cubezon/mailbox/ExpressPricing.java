package es.fractalgamestudios.cubezon.mailbox;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.util.Locale;

/**
 * Who sets the express fee (config.yml mailbox.express.pricing, published as express_pricing):
 * SERVER, the same fee for every shop (mailbox.express.fee); SHOP, each shop sets its own
 * (shops.express_fee, the server's fee while it has none); SHOP_CAPPED, the same but never above
 * mailbox.express.max-fee. The web charges it; the game and the web let shops set it.
 */
public enum ExpressPricing {
    SERVER("server"), SHOP("shop"), SHOP_CAPPED("shop-capped");

    private final String key;

    ExpressPricing(String key) {
        this.key = key;
    }

    /** The config.yml / plugin_settings name. */
    public String key() {
        return key;
    }

    public boolean shopsSetFee() {
        return this != SERVER;
    }

    /** The fee a shop's express orders pay. */
    public BigDecimal feeFor(BigDecimal serverFee, BigDecimal maxFee, @Nullable BigDecimal shopFee) {
        BigDecimal fee = this == SERVER || shopFee == null ? serverFee : shopFee;
        return this == SHOP_CAPPED ? fee.min(maxFee) : fee;
    }

    /** Whether a shop may set that fee (never when the server sets it). */
    public boolean accepts(BigDecimal shopFee, BigDecimal maxFee) {
        return shopsSetFee() && shopFee.signum() >= 0 && (this != SHOP_CAPPED || shopFee.compareTo(maxFee) <= 0);
    }

    public static ExpressPricing parse(@Nullable String raw) {
        String text = raw == null ? "" : raw.strip().toLowerCase(Locale.ROOT);
        for (ExpressPricing pricing : values()) {
            if (pricing.key.equals(text)) {
                return pricing;
            }
        }
        return SERVER;
    }
}
