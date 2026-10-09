package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Admin stick bound to one shop: left click = corner 1, right click = corner 2. */
public final class ZoneWand {

    /** The shop a wand marks the zone of. */
    public record Target(UUID shopId, String shopName) {
    }

    private final Plugin plugin;
    private final NamespacedKey shopIdKey;
    private final NamespacedKey shopNameKey;

    public ZoneWand(Plugin plugin) {
        this.plugin = plugin;
        this.shopIdKey = new NamespacedKey(plugin, "zone_wand_shop");
        this.shopNameKey = new NamespacedKey(plugin, "zone_wand_shop_name");
    }

    public ItemStack create(Target target, Messages messages) {
        // config.yml shops.zone-wand-material; anything that is not a usable item falls back to a stick.
        Material material = Material.matchMaterial(plugin.getConfig().getString("shops.zone-wand-material", "stick"));
        ItemStack wand = new ItemStack(material != null && material.isItem() && !material.isBlock() ? material : Material.STICK);
        wand.editMeta(meta -> {
            var shop = Placeholder.unparsed("shop", target.shopName());
            meta.displayName(messages.plain("shop.wand-name", shop).decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(
                    messages.plain("shop.wand-lore-1").decoration(TextDecoration.ITALIC, false),
                    messages.plain("shop.wand-lore-2").decoration(TextDecoration.ITALIC, false)));
            meta.setEnchantmentGlintOverride(true);
            PersistentDataContainer data = meta.getPersistentDataContainer();
            data.set(shopIdKey, PersistentDataType.STRING, target.shopId().toString());
            data.set(shopNameKey, PersistentDataType.STRING, target.shopName());
        });
        return wand;
    }

    public Optional<Target> read(@Nullable ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return Optional.empty();
        }
        PersistentDataContainer data = item.getItemMeta().getPersistentDataContainer();
        String shopId = data.get(shopIdKey, PersistentDataType.STRING);
        String shopName = data.get(shopNameKey, PersistentDataType.STRING);
        if (shopId == null || shopName == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(new Target(UUID.fromString(shopId), shopName));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** Removes every zone wand from the player's inventory, cursor included (also in creative). */
    public void removeAll(Player player) {
        var inventory = player.getInventory();
        for (int slot = 0; slot < inventory.getSize(); slot++) {
            if (read(inventory.getItem(slot)).isPresent()) {
                inventory.setItem(slot, null);
            }
        }
        if (read(player.getItemOnCursor()).isPresent()) {
            player.setItemOnCursor(null);
        }
        player.updateInventory();
    }
}
