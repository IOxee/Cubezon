package es.fractalgamestudios.cubezon.order;

import java.util.Locale;

/**
 * How web orders are handled (config.yml orders.mode). Read only at startup: switching modes
 * with orders in flight would mix both flows, so a restart is required.
 */
public enum OrderMode {
    /** The plugin charges and prepares every order by itself. */
    AUTOMATIC,
    /** Each shop accepts, prepares and delivers its orders from its company computer. */
    ROLEPLAY;

    public static OrderMode parse(String value) {
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            return AUTOMATIC;
        }
    }

    public String key() {
        return name().toLowerCase(Locale.ROOT);
    }
}
