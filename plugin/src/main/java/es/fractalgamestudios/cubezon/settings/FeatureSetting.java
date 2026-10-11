package es.fractalgamestudios.cubezon.settings;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * The config.yml options the server owner may change from the web admin panel
 * ({@code public.feature_settings}, key = config path). Only these: nothing else in config.yml
 * (the database, orders.mode...) can be touched from the web. Every value is validated here again,
 * whatever the web already checked.
 */
public enum FeatureSetting {
    STORAGE_BUY("storage.buy.enabled", Kind.BOOLEAN, 0, 0),
    COMPUTER_BUY("computer.buy.enabled", Kind.BOOLEAN, 0, 0),
    COMPUTER_PRICE("computer.buy.price", Kind.DECIMAL, 0, 1_000_000_000),
    TERMINAL_BUY("computer.delivery.buy.enabled", Kind.BOOLEAN, 0, 0),
    TERMINAL_PRICE("computer.delivery.buy.price", Kind.DECIMAL, 0, 1_000_000_000),
    MAILBOX_BUY("mailbox.buy.enabled", Kind.BOOLEAN, 0, 0),
    MAILBOX_PRICE("mailbox.buy.price", Kind.DECIMAL, 0, 1_000_000_000),
    MAILBOX_MAX("mailbox.max-per-player", Kind.INTEGER, 0, 20),
    EXPRESS_ENABLED("mailbox.express.enabled", Kind.BOOLEAN, 0, 0),
    EXPRESS_FEE("mailbox.express.fee", Kind.DECIMAL, 0, 1_000_000_000),
    EXPRESS_PRICING("mailbox.express.pricing", "server", "shop", "shop-capped"),
    EXPRESS_MAX_FEE("mailbox.express.max-fee", Kind.DECIMAL, 0, 1_000_000_000),
    EXPRESS_FEE_TO_SELLER("mailbox.express.fee-to-seller", Kind.BOOLEAN, 0, 0),
    HAND_DELIVERY("mailbox.express.hand-delivery", Kind.BOOLEAN, 0, 0),
    DELAY_MIN("orders.automatic.delay-min-minutes", Kind.INTEGER, 0, 1440),
    DELAY_MAX("orders.automatic.delay-max-minutes", Kind.INTEGER, 0, 1440),
    COURIER_MAX_PERCENT("orders.roleplay.courier-max-percent", Kind.INTEGER, 0, 100),
    TIPS_ENABLED("orders.tips.enabled", Kind.BOOLEAN, 0, 0),
    TIPS_MAX("orders.tips.max", Kind.DECIMAL, 0, 1_000_000_000);

    /** CHOICE: one of a fixed list of words (lowercase). */
    public enum Kind { BOOLEAN, INTEGER, DECIMAL, CHOICE }

    private final String key;
    private final Kind kind;
    private final long min;
    private final long max;
    private final List<String> choices;

    FeatureSetting(String key, Kind kind, long min, long max) {
        this.key = key;
        this.kind = kind;
        this.min = min;
        this.max = max;
        this.choices = List.of();
    }

    FeatureSetting(String key, String... choices) {
        this.key = key;
        this.kind = Kind.CHOICE;
        this.min = 0;
        this.max = 0;
        this.choices = List.of(choices);
    }

    /** The config.yml path, also the row key in public.feature_settings. */
    public String key() {
        return key;
    }

    /** The value as config.yml would hold it (Boolean, Integer, Double or String), or empty if invalid. */
    public Optional<Object> parse(@Nullable String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String text = raw.strip().toLowerCase(Locale.ROOT);
        try {
            return switch (kind) {
                case BOOLEAN -> text.equals("true") || text.equals("false") ? Optional.of(Boolean.parseBoolean(text)) : Optional.empty();
                case CHOICE -> choices.contains(text) ? Optional.of(text) : Optional.empty();
                case INTEGER -> {
                    int value = Integer.parseInt(text);
                    yield value >= min && value <= max ? Optional.of(value) : Optional.empty();
                }
                case DECIMAL -> {
                    BigDecimal value = new BigDecimal(text);
                    yield value.scale() <= 2 && value.compareTo(BigDecimal.valueOf(min)) >= 0
                            && value.compareTo(BigDecimal.valueOf(max)) <= 0
                            ? Optional.of(value.doubleValue()) : Optional.empty();
                }
            };
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public static Optional<FeatureSetting> byKey(String key) {
        return Arrays.stream(values()).filter(setting -> setting.key.equals(key)).findFirst();
    }

    /**
     * The values in force: each override (database rows, key → text) if valid, otherwise what
     * config.yml says. Unknown keys and invalid values are reported through {@code warn} and ignored.
     */
    public static Map<FeatureSetting, Object> effective(Map<FeatureSetting, Object> fileValues,
                                                       Map<String, String> overrides, Consumer<String> warn) {
        Map<FeatureSetting, Object> effective = new EnumMap<>(FeatureSetting.class);
        effective.putAll(fileValues);
        overrides.forEach((key, raw) -> byKey(key).ifPresentOrElse(
                setting -> setting.parse(raw).ifPresentOrElse(value -> effective.put(setting, value),
                        () -> warn.accept("Ignoring invalid value '" + raw + "' for feature " + key)),
                () -> warn.accept("Ignoring unknown feature " + key)));
        return effective;
    }

    /** {"path":value,...} in declaration order, for plugin_settings (the web shows what is in force). */
    public static String toJson(Map<FeatureSetting, Object> values) {
        return values.entrySet().stream()
                .map(entry -> "\"" + entry.getKey().key + "\":" + jsonValue(entry.getValue()))
                .collect(Collectors.joining(",", "{", "}"));
    }

    /** Numbers and booleans as they are; choices are plain lowercase words, so quoting is enough. */
    private static String jsonValue(Object value) {
        return value instanceof String text ? "\"" + text + "\"" : String.valueOf(value);
    }
}
