package es.fractalgamestudios.cubezon.i18n;

import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MessagesVersionTest {

    private static YamlConfiguration bundled() {
        return YamlConfiguration.loadConfiguration(new InputStreamReader(
                Objects.requireNonNull(MessagesVersionTest.class.getResourceAsStream("/lang/es.yml")), StandardCharsets.UTF_8));
    }

    private static YamlConfiguration parse(String yaml) throws InvalidConfigurationException {
        YamlConfiguration config = new YamlConfiguration();
        config.loadFromString(yaml);
        return config;
    }

    @Test
    void fileWithoutVersionIsOutdated() throws InvalidConfigurationException {
        assertTrue(Messages.isOutdated(parse("prefix: '[Cubezon] '\n"), bundled()));
    }

    @Test
    void sameVersionIsKept() {
        assertFalse(Messages.isOutdated(bundled(), bundled()));
    }

    @Test
    void bundledTextsUseOnlyEnglishCommands() {
        String texts = bundled().saveToString();
        for (String spanish : new String[]{"/cz vincular", "/cz depositar", "/cz recoger", "/cz tienda", "/cz almacen",
                "/cz ordenador", "/cz empleado", "/cz objeto", "/cz taquilla"}) {
            assertFalse(texts.contains(spanish), spanish);
        }
    }
}
