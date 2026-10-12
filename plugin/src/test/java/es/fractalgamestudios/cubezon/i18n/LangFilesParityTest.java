package es.fractalgamestudios.cubezon.i18n;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Every bundled language must have the same texts, placeholders and tags, so switching locale never breaks a message. */
class LangFilesParityTest {

    /** MiniMessage tags and placeholders (<red>, </red>, <amount>, <click:...>), %s and {x}. */
    private static final Pattern TOKEN = Pattern.compile("<[^<>]+>|%[a-z]|\\{[^{}]+}");

    private static YamlConfiguration bundled(String locale) {
        return YamlConfiguration.loadConfiguration(new InputStreamReader(Objects.requireNonNull(
                LangFilesParityTest.class.getResourceAsStream("/lang/" + locale + ".yml"), locale), StandardCharsets.UTF_8));
    }

    private static Set<String> tokens(String text) {
        Set<String> found = new TreeSet<>();
        Matcher matcher = TOKEN.matcher(text);
        while (matcher.find()) {
            found.add(matcher.group());
        }
        return found;
    }

    @Test
    void defaultLocaleIsBundled() {
        assertTrue(Messages.BUNDLED_LOCALES.contains(Messages.DEFAULT_LOCALE));
    }

    @Test
    void allLanguagesHaveTheSameKeys() {
        Set<String> english = bundled("en").getKeys(true);
        for (String locale : Messages.BUNDLED_LOCALES) {
            assertEquals(new TreeSet<>(english), new TreeSet<>(bundled(locale).getKeys(true)), locale);
        }
    }

    @Test
    void allLanguagesHaveTheSameVersion() {
        int english = bundled("en").getInt("lang-version");
        for (String locale : Messages.BUNDLED_LOCALES) {
            assertEquals(english, bundled(locale).getInt("lang-version"), locale);
        }
    }

    @Test
    void allLanguagesUseTheSamePlaceholdersAndTags() {
        YamlConfiguration english = bundled("en");
        for (String locale : Messages.BUNDLED_LOCALES) {
            YamlConfiguration other = bundled(locale);
            for (String key : english.getKeys(true)) {
                if (english.isString(key)) {
                    assertEquals(tokens(english.getString(key)), tokens(Objects.requireNonNull(other.getString(key), key)),
                            locale + ": " + key);
                }
            }
        }
    }
}
