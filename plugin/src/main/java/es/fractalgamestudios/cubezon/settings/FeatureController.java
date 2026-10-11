package es.fractalgamestudios.cubezon.settings;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.FeatureRepository;
import es.fractalgamestudios.cubezon.database.RoleplayRepository;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;

/**
 * Applies the web admin panel's overrides ({@code public.feature_settings}) on top of config.yml, in
 * memory only: the file is never rewritten, and deleting an override brings the file's value back.
 * Every option is read when used, so a change applies within one refresh (settings.refresh-seconds).
 * What is in force is published to the web as {@code plugin_settings.features}.
 */
public final class FeatureController {

    private final CubezonPlugin plugin;
    /** config.yml's own values, taken right after it is (re)loaded and before any override. */
    private Map<FeatureSetting, Object> fileValues = Map.of();
    private String published = "";

    public FeatureController(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    /** Main thread, right after config.yml is loaded or reloaded (nothing overridden yet). */
    public void snapshotFile() {
        Map<FeatureSetting, Object> values = new EnumMap<>(FeatureSetting.class);
        for (FeatureSetting setting : FeatureSetting.values()) {
            Object raw = plugin.getConfig().get(setting.key());
            if (raw != null) {
                setting.parse(String.valueOf(raw)).ifPresent(value -> values.put(setting, value));
            }
        }
        fileValues = Map.copyOf(values);
        published = "";
    }

    /** Reads the overrides off the main thread and applies them on it. */
    public void refresh() {
        FeatureRepository features = plugin.features();
        if (features == null) {
            apply(Map.of());
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                Map<String, String> overrides = features.findAll();
                if (plugin.isEnabled()) {
                    plugin.getServer().getScheduler().runTask(plugin, () -> apply(overrides));
                }
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not read the feature settings", e);
            }
        });
    }

    /** Main thread. */
    private void apply(Map<String, String> overrides) {
        List<String> warnings = new ArrayList<>();
        Map<FeatureSetting, Object> effective = FeatureSetting.effective(fileValues, overrides, warnings::add);
        effective.forEach((setting, value) -> plugin.getConfig().set(setting.key(), value));
        String json = FeatureSetting.toJson(effective);
        if (json.equals(published)) {
            return;
        }
        published = json;
        warnings.forEach(plugin.getLogger()::warning);
        if (!overrides.isEmpty()) {
            plugin.getLogger().info("Web feature settings in force: " + overrides.keySet());
        }
        // Values the web shows elsewhere (express fee, mailboxes, delays...) follow the change.
        plugin.mailboxController().publishSettings();
        plugin.roleplayController().publishMode();
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay != null) {
            plugin.dbExecutor().execute(() -> {
                try {
                    roleplay.publishSetting("features", json);
                } catch (SQLException e) {
                    plugin.getLogger().log(Level.WARNING, "Could not publish the feature settings", e);
                }
            });
        }
    }
}
