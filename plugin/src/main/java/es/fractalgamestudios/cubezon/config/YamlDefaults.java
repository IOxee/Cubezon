package es.fractalgamestudios.cubezon.config;

import org.bukkit.configuration.ConfigurationSection;

import java.util.ArrayList;
import java.util.List;

/**
 * Brings a server's YAML file up to date with the copy bundled in the jar: every option the file
 * lacks is added with its default value and comments; options already present (and their values)
 * are never touched. Without this, a config.yml created by an older version never shows the
 * options added later (e.g. orders.mode), so the admin cannot find or change them.
 */
public final class YamlDefaults {

    private YamlDefaults() {
    }

    /**
     * @return the paths that were added (empty if the file was already complete); the caller saves
     */
    public static List<String> addMissing(ConfigurationSection target, ConfigurationSection defaults) {
        List<String> added = new ArrayList<>();
        // getKeys(true) lists a section before its children, so sections exist before their values.
        for (String path : defaults.getKeys(true)) {
            if (target.isSet(path) || isInsideAdded(path, added)) {
                continue;
            }
            if (defaults.isConfigurationSection(path)) {
                target.createSection(path);
                copyComments(target, defaults, path);
                for (String child : defaults.getConfigurationSection(path).getKeys(true)) {
                    String childPath = path + "." + child;
                    if (!defaults.isConfigurationSection(childPath)) {
                        target.set(childPath, defaults.get(childPath));
                    }
                    copyComments(target, defaults, childPath);
                }
            } else {
                target.set(path, defaults.get(path));
                copyComments(target, defaults, path);
            }
            added.add(path);
        }
        return added;
    }

    private static boolean isInsideAdded(String path, List<String> added) {
        return added.stream().anyMatch(section -> path.startsWith(section + "."));
    }

    private static void copyComments(ConfigurationSection target, ConfigurationSection defaults, String path) {
        target.setComments(path, defaults.getComments(path));
        target.setInlineComments(path, defaults.getInlineComments(path));
    }
}
