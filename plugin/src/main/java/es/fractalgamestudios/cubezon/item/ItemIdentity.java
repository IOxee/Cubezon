package es.fractalgamestudios.cubezon.item;

import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.PluginManager;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.logging.Logger;

/**
 * Turns any item into an {@link ItemKey}, so listings can sell items from other plugins and mods.
 * Asks, in order:
 * <ol>
 *   <li>item plugins with their own API (ItemsAdder, MMOItems, CraftEngine), through reflection: no compile
 *       dependency, and nothing happens when they are not installed;</li>
 *   <li>PersistentDataContainer keys listed in config.yml (Nexo, Oraxen, Slimefun... or any plugin
 *       that tags its items with an id);</li>
 *   <li>the material's own namespaced key: minecraft:diamond, or create:wrench for a mod item on a
 *       hybrid server.</li>
 * </ol>
 */
public final class ItemIdentity {

    /** One way of recognising custom items. */
    private interface Provider {
        Optional<ItemKey> identify(ItemStack item);
    }

    private final List<Provider> providers;
    private final List<String> active;

    private ItemIdentity(List<Provider> providers, List<String> active) {
        this.providers = providers;
        this.active = active;
    }

    /** Builds the providers from the installed plugins and the configured PDC keys. */
    public static ItemIdentity create(PluginManager plugins, List<String> pdcKeys, Logger logger) {
        List<Provider> providers = new ArrayList<>();
        List<String> active = new ArrayList<>();

        reflective(plugins, "ItemsAdder", logger).ifPresent(plugin -> {
            try {
                Class<?> customStack = Class.forName("dev.lone.itemsadder.api.CustomStack", true, plugin.getClass().getClassLoader());
                Method byItemStack = customStack.getMethod("byItemStack", ItemStack.class);
                Method namespacedId = customStack.getMethod("getNamespacedID");
                providers.add(item -> invoke(() -> {
                    Object stack = byItemStack.invoke(null, item);
                    return stack == null ? null : "itemsadder:" + namespacedId.invoke(stack);
                }).map(key -> new ItemKey(key, "itemsadder", vanillaId(item.getType()))));
                active.add("ItemsAdder");
            } catch (ReflectiveOperationException | LinkageError e) {
                logger.warning("ItemsAdder found but its API could not be used: " + e);
            }
        });

        reflective(plugins, "MMOItems", logger).ifPresent(plugin -> {
            try {
                Class<?> mmoItems = Class.forName("net.Indyuce.mmoitems.MMOItems", true, plugin.getClass().getClassLoader());
                Method typeName = mmoItems.getMethod("getTypeName", ItemStack.class);
                Method id = mmoItems.getMethod("getID", ItemStack.class);
                providers.add(item -> invoke(() -> {
                    Object type = typeName.invoke(null, item);
                    Object itemId = id.invoke(null, item);
                    return type == null || itemId == null ? null : "mmoitems:" + type + ":" + itemId;
                }).map(key -> new ItemKey(key, "mmoitems", vanillaId(item.getType()))));
                active.add("MMOItems");
            } catch (ReflectiveOperationException | LinkageError e) {
                logger.warning("MMOItems found but its API could not be used: " + e);
            }
        });

        // CraftEngine keeps its id at the root of minecraft:custom_data, outside the Bukkit PDC.
        reflective(plugins, "CraftEngine", logger).ifPresent(plugin -> {
            try {
                Class<?> items = Class.forName("net.momirealms.craftengine.bukkit.api.CraftEngineItems", true, plugin.getClass().getClassLoader());
                Method customItemId = items.getMethod("getCustomItemId", ItemStack.class);
                providers.add(item -> invoke(() -> {
                    Object id = customItemId.invoke(null, item);
                    return id == null ? null : "craftengine:" + id;
                }).map(key -> new ItemKey(key, "craftengine", vanillaId(item.getType()))));
                active.add("CraftEngine");
            } catch (ReflectiveOperationException | LinkageError e) {
                logger.warning("CraftEngine found but its API could not be used: " + e);
            }
        });

        for (String configured : pdcKeys) {
            NamespacedKey pdcKey = NamespacedKey.fromString(configured.trim().toLowerCase(Locale.ROOT));
            if (pdcKey == null) {
                logger.warning("Invalid items.pdc-keys entry: " + configured);
                continue;
            }
            String source = "pdc:" + pdcKey;
            providers.add(item -> {
                if (!item.hasItemMeta()) {
                    return Optional.empty();
                }
                PersistentDataContainer data = item.getItemMeta().getPersistentDataContainer();
                String value = data.get(pdcKey, PersistentDataType.STRING);
                return value == null || value.isBlank()
                        ? Optional.empty()
                        : Optional.of(new ItemKey(pdcKey.getNamespace() + ":" + value, source, vanillaId(item.getType())));
            });
            active.add(source);
        }
        return new ItemIdentity(List.copyOf(providers), List.copyOf(active));
    }

    public ItemKey identify(ItemStack item) {
        for (Provider provider : providers) {
            Optional<ItemKey> key = provider.identify(item);
            if (key.isPresent() && isValidKey(key.get().key())) {
                return key.get();
            }
        }
        NamespacedKey materialKey = item.getType().getKey();
        return new ItemKey(materialKey.toString(), materialKey.getNamespace().equals(NamespacedKey.MINECRAFT) ? "vanilla" : "mod",
                vanillaId(item.getType()));
    }

    /** Providers in use, for the startup log. */
    public List<String> active() {
        return active;
    }

    /** Same rule as the database check on listings.item_key. */
    static boolean isValidKey(String key) {
        return key.matches("^[a-z0-9_.-]+:[A-Za-z0-9_./:-]+$");
    }

    /** Vanilla id of the material, or barrier for items vanilla does not know (mods). */
    static String vanillaId(Material material) {
        NamespacedKey key = material.getKey();
        return key.getNamespace().equals(NamespacedKey.MINECRAFT) ? key.getKey() : "barrier";
    }

    private static Optional<Plugin> reflective(PluginManager plugins, String name, Logger logger) {
        Plugin plugin = plugins.getPlugin(name);
        if (plugin == null || !plugin.isEnabled()) {
            return Optional.empty();
        }
        logger.info("Custom items: using " + name + ".");
        return Optional.of(plugin);
    }

    private interface Call {
        String call() throws ReflectiveOperationException;
    }

    /** A failing third-party call just means "not one of mine": fall through to the next provider. */
    private static Optional<String> invoke(Call call) {
        try {
            return Optional.ofNullable(call.call());
        } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
            return Optional.empty();
        }
    }
}
