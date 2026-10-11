package es.fractalgamestudios.cubezon.command;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** plugin.yml is what permission plugins (LuckPerms...) list and inherit from: it must match {@link Perm}. */
class PermTest {

    /** Node names contain dots, so "/" is the path separator here. */
    private static ConfigurationSection declared() throws IOException {
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.options().pathSeparator('/');
        try (Reader reader = Files.newBufferedReader(Path.of("src/main/resources/plugin.yml"))) {
            yaml.load(reader);
        } catch (InvalidConfigurationException e) {
            throw new IOException(e);
        }
        return yaml.getConfigurationSection("permissions");
    }

    @Test
    void everyNodeIsDeclaredInPluginYmlAndViceVersa() throws IOException {
        Set<String> inEnum = Arrays.stream(Perm.values()).map(Perm::node).collect(Collectors.toSet());
        assertEquals(inEnum, declared().getKeys(false));
    }

    @Test
    void playerNodesDefaultToEveryoneAndAdminNodesToOps() throws IOException {
        ConfigurationSection permissions = declared();
        for (Perm perm : Perm.values()) {
            String expected = perm.adminOnly() ? "op" : "true";
            assertEquals(expected, permissions.getString(perm.node() + "/default"), perm.node());
        }
    }

    @Test
    void theAdminParentGrantsEveryAdminNode() throws IOException {
        ConfigurationSection children = declared().getConfigurationSection("cubezon.admin/children");
        Set<String> expected = Arrays.stream(Perm.values())
                .filter(perm -> perm.adminOnly() && perm != Perm.ADMIN)
                .map(Perm::node)
                .collect(Collectors.toSet());
        assertEquals(expected, children.getKeys(false));
        for (String child : children.getKeys(false)) {
            assertTrue(children.getBoolean(child), child);
        }
    }

    @Test
    void theUseParentGrantsEveryPlayerNode() throws IOException {
        ConfigurationSection children = declared().getConfigurationSection("cubezon.use/children");
        Set<String> expected = Arrays.stream(Perm.values())
                .filter(perm -> !perm.adminOnly() && perm != Perm.USE)
                .map(Perm::node)
                .collect(Collectors.toSet());
        assertEquals(expected, children.getKeys(false));
    }
}
