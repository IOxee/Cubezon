package es.fractalgamestudios.cubezon.order;

import org.bukkit.configuration.ConfigurationSection;

/**
 * Automatic mode: how long a new order waits before the plugin processes it. Each order gets its own wait,
 * between {@code minSeconds} and {@code maxSeconds}, derived from its id (see OrderRepository), so deliveries
 * do not all land at the same moment.
 */
public record OrderDelay(int minSeconds, int maxSeconds) {

    public static final OrderDelay NONE = new OrderDelay(0, 0);

    private static final int MAX_SECONDS = 24 * 60 * 60;

    /** Config values in minutes: negatives become 0, a maximum below the minimum collapses to it, one day at most. */
    public static OrderDelay ofMinutes(double min, double max) {
        int low = toSeconds(min);
        int high = Math.max(low, toSeconds(max));
        return new OrderDelay(low, high);
    }

    /** From config.yml orders.automatic (defaults 5 to 10 minutes). */
    public static OrderDelay fromConfig(ConfigurationSection config) {
        return ofMinutes(config.getDouble("orders.automatic.delay-min-minutes", 5),
                config.getDouble("orders.automatic.delay-max-minutes", 10));
    }

    private static int toSeconds(double minutes) {
        long seconds = Math.round(Math.max(0, minutes) * 60);
        return (int) Math.min(seconds, MAX_SECONDS);
    }

    public int rangeSeconds() {
        return maxSeconds - minSeconds;
    }

    public boolean isNone() {
        return maxSeconds == 0;
    }
}
