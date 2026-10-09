package es.fractalgamestudios.cubezon.gui;

import es.fractalgamestudios.cubezon.config.YamlDefaults;
import net.kyori.adventure.text.Component;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.components.CustomModelDataComponent;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.Nullable;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * menus.yml: where each button of the computer menus goes and which icon it uses, so a server can
 * rearrange or hide them without touching code. Missing entries are added to the server's file on
 * load, like config.yml; anything invalid falls back to the built-in default.
 */
public final class MenuLayout {

    private static final String FILE = "menus.yml";

    private final JavaPlugin plugin;
    private YamlConfiguration layout = new YamlConfiguration();

    public MenuLayout(JavaPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    public void reload() {
        File file = new File(plugin.getDataFolder(), FILE);
        if (!file.exists()) {
            plugin.saveResource(FILE, false);
        }
        layout = YamlConfiguration.loadConfiguration(file);
        InputStream bundled = plugin.getResource(FILE);
        if (bundled == null) {
            return;
        }
        YamlConfiguration defaults = YamlConfiguration.loadConfiguration(new InputStreamReader(bundled, StandardCharsets.UTF_8));
        layout.setDefaults(defaults);
        List<String> added = YamlDefaults.addMissing(layout, defaults);
        if (!added.isEmpty()) {
            try {
                layout.save(file);
                plugin.getLogger().info("Added " + added.size() + " new buttons to " + FILE + ".");
            } catch (IOException e) {
                plugin.getLogger().warning("Could not update " + FILE + ": " + e.getMessage());
            }
        }
    }

    /** -1 (or anything outside the menu) hides the button: {@link Gui#set} ignores it. */
    public int slot(String button, int fallback) {
        return layout.getInt(button + ".slot", fallback);
    }

    public Material material(String button, Material fallback) {
        Material material = Material.matchMaterial(layout.getString(button + ".material", ""));
        return material != null && material.isItem() && !material.isAir() ? material : fallback;
    }

    /**
     * The button's icon: its material plus the optional looks from menus.yml, so a resource pack can
     * draw custom icons: item-model (an item model id, e.g. mypack:buttons/accept), custom-model-data
     * (a number) and glow (true/false).
     */
    public ItemStack icon(String button, Material fallback) {
        ItemStack icon = new ItemStack(material(button, fallback));
        String model = layout.getString(button + ".item-model", "");
        NamespacedKey modelKey = model.isBlank() ? null : NamespacedKey.fromString(model.toLowerCase(Locale.ROOT));
        boolean hasData = layout.isSet(button + ".custom-model-data") && layout.isInt(button + ".custom-model-data");
        boolean hasGlow = layout.isBoolean(button + ".glow");
        if (modelKey == null && !hasData && !hasGlow) {
            if (!model.isBlank()) {
                plugin.getLogger().warning("Invalid item-model in " + FILE + " " + button + ": " + model);
            }
            return icon;
        }
        icon.editMeta(meta -> {
            if (modelKey != null) {
                meta.setItemModel(modelKey);
            }
            if (hasData) {
                CustomModelDataComponent data = meta.getCustomModelDataComponent();
                data.setFloats(List.of((float) layout.getInt(button + ".custom-model-data")));
                meta.setCustomModelDataComponent(data);
            }
            if (hasGlow) {
                meta.setEnchantmentGlintOverride(layout.getBoolean(button + ".glow"));
            }
        });
        return icon;
    }

    /** common.filler: what fills the empty slots of every menu; null (material: none) leaves them empty. */
    public @Nullable ItemStack filler() {
        String material = layout.getString("common.filler.material", "none");
        if (material.isBlank() || material.equalsIgnoreCase("none") || material.equalsIgnoreCase("air")) {
            return null;
        }
        ItemStack filler = icon("common.filler", Material.GRAY_STAINED_GLASS_PANE);
        filler.editMeta(meta -> {
            meta.displayName(Component.empty());
            meta.setHideTooltip(true);
        });
        return filler;
    }
}
