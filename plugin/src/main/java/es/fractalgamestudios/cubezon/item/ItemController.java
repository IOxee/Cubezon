package es.fractalgamestudios.cubezon.item;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.CustomItemRepository;
import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.sql.SQLException;
import java.util.Locale;
import java.util.UUID;
import java.util.logging.Level;

/**
 * /cz item info: the key of the item in hand (what a seller puts in a listing).
 * /cz item register (admin): adds the item in hand to the web catalog (custom_items).
 */
public final class ItemController {

    private final CubezonPlugin plugin;

    public ItemController(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    public void info(Player player) {
        Messages messages = plugin.messages();
        ItemStack item = player.getInventory().getItemInMainHand();
        if (item.isEmpty()) {
            player.sendMessage(messages.get("item.empty-hand"));
            return;
        }
        ItemKey key = plugin.itemIdentity().identify(item);
        player.sendMessage(messages.get("item.info", tags(key, item)));
    }

    public void register(Player player) {
        Messages messages = plugin.messages();
        ItemStack item = player.getInventory().getItemInMainHand();
        if (item.isEmpty()) {
            player.sendMessage(messages.get("item.empty-hand"));
            return;
        }
        ItemKey key = plugin.itemIdentity().identify(item);
        if (!key.custom()) {
            player.sendMessage(messages.get("item.vanilla", tags(key, item)));
            return;
        }
        CustomItemRepository customItems = plugin.customItems();
        if (customItems == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        String name = displayName(item, key);
        int maxStack = Math.min(99, item.getMaxStackSize());
        byte[] sample = item.asOne().serializeAsBytes();
        UUID playerId = player.getUniqueId();
        TagResolver tags = tags(key, item);
        plugin.dbExecutor().execute(() -> {
            try {
                boolean created = customItems.register(key, name, maxStack, sample, playerId);
                player.sendMessage(messages.get(created ? "item.registered" : "item.updated", tags));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not register custom item " + key.key(), e);
                player.sendMessage(messages.get("item.failed"));
            }
        });
    }

    private TagResolver tags(ItemKey key, ItemStack item) {
        return TagResolver.resolver(
                Placeholder.unparsed("key", key.key()),
                Placeholder.unparsed("source", key.source()),
                Placeholder.unparsed("base", key.baseMaterial()),
                Placeholder.unparsed("name", displayName(item, key)),
                Placeholder.unparsed("stack", String.valueOf(item.getMaxStackSize())));
    }

    /** Custom name, then item name, then a readable version of the key. */
    static String displayName(ItemStack item, ItemKey key) {
        if (item.hasItemMeta()) {
            ItemMeta meta = item.getItemMeta();
            Component name = meta.hasDisplayName() ? meta.displayName() : meta.hasItemName() ? meta.itemName() : null;
            if (name != null) {
                String plain = PlainTextComponentSerializer.plainText().serialize(name).strip();
                if (!plain.isEmpty()) {
                    return plain.length() > 80 ? plain.substring(0, 80) : plain;
                }
            }
        }
        String id = key.key().substring(key.key().lastIndexOf(':') + 1).replace('_', ' ').toLowerCase(Locale.ROOT);
        return id.isEmpty() ? key.key() : Character.toUpperCase(id.charAt(0)) + id.substring(1);
    }
}
