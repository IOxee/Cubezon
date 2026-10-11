package es.fractalgamestudios.cubezon.settings;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FeatureSettingTest {

    @Test
    void parsesEachKindWithinItsRange() {
        assertEquals(Optional.of(false), FeatureSetting.EXPRESS_ENABLED.parse("false"));
        assertEquals(Optional.of(true), FeatureSetting.EXPRESS_ENABLED.parse(" TRUE "));
        assertEquals(Optional.of(250.5), FeatureSetting.COMPUTER_PRICE.parse("250.50"));
        assertEquals(Optional.of(30), FeatureSetting.COURIER_MAX_PERCENT.parse("30"));
    }

    @Test
    void rejectsValuesOutOfRangeOrMalformed() {
        assertEquals(Optional.empty(), FeatureSetting.EXPRESS_ENABLED.parse("yes"));
        assertEquals(Optional.empty(), FeatureSetting.COURIER_MAX_PERCENT.parse("101"));
        assertEquals(Optional.empty(), FeatureSetting.COMPUTER_PRICE.parse("-1"));
        assertEquals(Optional.empty(), FeatureSetting.COMPUTER_PRICE.parse("12.345"));
        assertEquals(Optional.empty(), FeatureSetting.MAILBOX_MAX.parse("2.5"));
        assertEquals(Optional.empty(), FeatureSetting.DELAY_MIN.parse(null));
    }

    @Test
    void findsSettingsByTheirConfigPathOnly() {
        assertEquals(Optional.of(FeatureSetting.HAND_DELIVERY), FeatureSetting.byKey("mailbox.express.hand-delivery"));
        assertEquals(Optional.empty(), FeatureSetting.byKey("orders.mode"));
        assertEquals(Optional.empty(), FeatureSetting.byKey("database.password"));
    }

    @Test
    void overridesReplaceFileValuesAndBadRowsAreIgnored() {
        Map<FeatureSetting, Object> file = new EnumMap<>(FeatureSetting.class);
        file.put(FeatureSetting.EXPRESS_ENABLED, true);
        file.put(FeatureSetting.COURIER_MAX_PERCENT, 50);
        List<String> warnings = new ArrayList<>();

        Map<FeatureSetting, Object> effective = FeatureSetting.effective(file, Map.of(
                "mailbox.express.enabled", "false",
                "orders.roleplay.courier-max-percent", "500",
                "orders.mode", "roleplay"), warnings::add);

        assertEquals(false, effective.get(FeatureSetting.EXPRESS_ENABLED));
        assertEquals(50, effective.get(FeatureSetting.COURIER_MAX_PERCENT), "an invalid override keeps the file value");
        assertEquals(2, warnings.size(), "the invalid value and the unknown key are reported");
        assertTrue(effective.keySet().stream().noneMatch(setting -> setting.key().equals("orders.mode")));
    }

    @Test
    void publishedJsonListsEveryEffectiveValue() {
        Map<FeatureSetting, Object> values = new EnumMap<>(FeatureSetting.class);
        values.put(FeatureSetting.EXPRESS_ENABLED, false);
        values.put(FeatureSetting.EXPRESS_FEE, 100.0);

        assertEquals("{\"mailbox.express.enabled\":false,\"mailbox.express.fee\":100.0}", FeatureSetting.toJson(values));
    }
}
