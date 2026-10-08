package es.fractalgamestudios.cubezon.i18n;

import es.fractalgamestudios.cubezon.config.YamlDefaults;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Player-facing texts loaded from lang/{locale}.yml, falling back to the bundled copy. */
public final class Messages {

    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();

    private final JavaPlugin plugin;
    private YamlConfiguration lang;

    public Messages(JavaPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public void reload() {
        String locale = plugin.getConfig().getString("locale", "es");
        String path = "lang/" + locale + ".yml";
        File file = new File(plugin.getDataFolder(), path);
        if (!file.exists() && plugin.getResource(path) != null) {
            plugin.saveResource(path, false);
        }
        lang = YamlConfiguration.loadConfiguration(file);

        InputStream bundled = plugin.getResource(path);
        if (bundled == null) {
            bundled = plugin.getResource("lang/es.yml");
        }
        if (bundled != null) {
            YamlConfiguration defaults = YamlConfiguration.loadConfiguration(
                    new InputStreamReader(bundled, StandardCharsets.UTF_8));
            if (isOutdated(lang, defaults) && file.exists() && plugin.getResource(path) != null) {
                lang = replaceOutdated(file, path, lang.getInt("lang-version", 1));
            }
            lang.setDefaults(defaults);
            // Show texts added by newer versions in the server's copy, so they can be edited too.
            List<String> added = YamlDefaults.addMissing(lang, defaults);
            if (!added.isEmpty() && file.exists()) {
                try {
                    lang.save(file);
                    plugin.getLogger().info("Added " + added.size() + " new texts to " + path + ".");
                } catch (IOException e) {
                    plugin.getLogger().warning("Could not update " + path + ": " + e.getMessage());
                }
            }
        }
    }

    /**
     * Texts that already exist are never overwritten by {@link YamlDefaults}, so when the plugin
     * changes existing texts (e.g. command names) it raises lang-version. A server file without it
     * counts as version 1. Read before setDefaults, or the bundled value would hide a missing key.
     */
    static boolean isOutdated(YamlConfiguration server, YamlConfiguration bundled) {
        int serverVersion = server.isSet("lang-version") ? server.getInt("lang-version") : 1;
        return bundled.getInt("lang-version", 1) > serverVersion;
    }

    /** Keeps the admin's copy as lang/<locale>.yml.bak-v<old> and writes the bundled file in its place. */
    private YamlConfiguration replaceOutdated(File file, String path, int oldVersion) {
        File backup = new File(file.getParentFile(), file.getName() + ".bak-v" + oldVersion);
        if (backup.exists() || !file.renameTo(backup)) {
            plugin.getLogger().warning("Could not back up " + path + "; keeping it (some texts may be outdated).");
            return YamlConfiguration.loadConfiguration(file);
        }
        plugin.saveResource(path, true);
        plugin.getLogger().info(path + " was outdated: replaced with the new texts; your copy is in " + backup.getName() + ".");
        return YamlConfiguration.loadConfiguration(file);
    }

    /** Message with the configured prefix. */
    public Component get(String key, TagResolver... resolvers) {
        String prefix = lang.getString("prefix");
        return MINI_MESSAGE.deserialize((prefix == null ? "" : prefix) + raw(key), resolvers);
    }

    /** Message without prefix, for multi-line output. */
    public Component plain(String key, TagResolver... resolvers) {
        return MINI_MESSAGE.deserialize(raw(key), resolvers);
    }

    private String raw(String key) {
        // getString(key, fallback) would skip the bundled defaults: keys added after the
        // server copied lang/<locale>.yml must still resolve.
        String message = lang.getString(key);
        return message != null ? message : "<red>Missing message: " + key + "</red>";
    }
}
