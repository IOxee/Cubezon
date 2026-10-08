package es.fractalgamestudios.cubezon.config;

import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class YamlDefaultsTest {

    /** config.yml as the first version wrote it, with a value the admin changed. */
    private static final String OLD_CONFIG = """
            # Idioma de los mensajes
            locale: es
            database:
              enabled: true
              url: ''
              user: ''
              password: ''
              pool-size: 8
            link:
              code-ttl-minutes: 10
            """;

    private static YamlConfiguration bundledConfig() {
        return YamlConfiguration.loadConfiguration(new InputStreamReader(
                Objects.requireNonNull(YamlDefaultsTest.class.getResourceAsStream("/config.yml")), StandardCharsets.UTF_8));
    }

    private static YamlConfiguration parse(String yaml) throws InvalidConfigurationException {
        YamlConfiguration config = new YamlConfiguration();
        config.loadFromString(yaml);
        return config;
    }

    @Test
    void addsTheOptionsAnOldFileLacksWithTheirComments() throws InvalidConfigurationException {
        YamlConfiguration server = parse(OLD_CONFIG);

        List<String> added = YamlDefaults.addMissing(server, bundledConfig());

        assertTrue(added.contains("orders"), added.toString());
        assertTrue(added.contains("storage"), added.toString());
        assertTrue(added.contains("computer"), added.toString());
        assertEquals("automatic", server.getString("orders.mode"));
        assertEquals(48, server.getInt("orders.roleplay.accept-hours"));
        assertTrue(server.getBoolean("storage.buy.enabled"));
        // The comment that explains how to change the mode travels with it.
        String saved = server.saveToString();
        assertTrue(saved.contains("mode: automatic"), saved);
        assertTrue(saved.contains("READ ONLY AT STARTUP"), saved);
    }

    @Test
    void keepsTheValuesTheAdminChanged() throws InvalidConfigurationException {
        YamlConfiguration server = parse(OLD_CONFIG + "orders:\n  mode: roleplay\n");

        List<String> added = YamlDefaults.addMissing(server, bundledConfig());

        assertEquals(8, server.getInt("database.pool-size"));
        assertTrue(server.getBoolean("database.enabled"));
        assertEquals("roleplay", server.getString("orders.mode"));
        assertFalse(added.contains("orders.mode"));
        assertTrue(added.contains("orders.poll-seconds"), added.toString());
    }

    @Test
    void completeFileIsLeftAlone() {
        YamlConfiguration server = bundledConfig();

        assertTrue(YamlDefaults.addMissing(server, bundledConfig()).isEmpty());
    }
}
