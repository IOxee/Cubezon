package es.fractalgamestudios.cubezon.pickup;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.PickupRepository;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.Locker;
import es.fractalgamestudios.cubezon.mailbox.Mailbox;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Locker pickup: lists the buyer's READY orders and hands one over per click.
 * The database marks the order COLLECTED (and its units DELIVERED) before the items are given,
 * so a crash can lose a pickup (still recoverable from the DELIVERED rows and the log) but never
 * duplicate it.
 */
public final class PickupController {

    private final CubezonPlugin plugin;
    /** Players with a pickup in flight: one at a time, so double clicks cannot race. */
    private final Set<UUID> collecting = ConcurrentHashMap.newKeySet();

    public PickupController(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    private interface Finder {
        List<ReadyOrder> find(PickupRepository pickups) throws SQLException;
    }

    /** Opens the pickup menu of a locker (the caller already checked it is active). */
    public void open(Player player, Locker locker) {
        UUID playerId = player.getUniqueId();
        open(player, Placeholder.unparsed("locker", locker.name()), pickups -> pickups.findReady(playerId, locker.id()));
    }

    /** The owner's mailbox: their express orders. */
    public void openMailbox(Player player, Mailbox mailbox) {
        UUID playerId = player.getUniqueId();
        open(player, Placeholder.component("locker", plugin.messages().plain("mailbox.pickup-name")),
                pickups -> pickups.findReadyAtMailbox(playerId, mailbox.id()));
    }

    private void open(Player player, TagResolver lockerTag, Finder finder) {
        Messages messages = plugin.messages();
        PickupRepository pickups = plugin.pickups();
        if (pickups == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        plugin.dbExecutor().execute(() -> {
            List<ReadyOrder> orders;
            try {
                orders = finder.find(pickups);
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not load the orders of " + player.getName(), e);
                player.sendMessage(messages.get("pickup.failed"));
                return;
            }
            if (orders.isEmpty()) {
                player.sendMessage(messages.get("pickup.empty", lockerTag));
                return;
            }
            runOnMainThread(() -> {
                if (player.isOnline()) {
                    player.openInventory(buildMenu(orders, lockerTag));
                }
            });
        });
    }

    /** Main thread, from a click in the menu. */
    public void collect(Player player, ReadyOrder order) {
        Messages messages = plugin.messages();
        PickupRepository pickups = plugin.pickups();
        if (pickups == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        int freeSlots = freeSlots(player);
        if (freeSlots < order.units().size()) {
            player.sendMessage(messages.get("pickup.no-space",
                    Placeholder.unparsed("slots", String.valueOf(order.units().size()))));
            return;
        }
        UUID playerId = player.getUniqueId();
        if (!collecting.add(playerId)) {
            return;
        }
        player.closeInventory();
        TagResolver tags = TagResolver.resolver(
                Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                Placeholder.unparsed("title", order.title()));
        plugin.dbExecutor().execute(() -> {
            List<byte[]> units;
            try {
                units = pickups.collect(order.id(), playerId).orElse(null);
            } catch (SQLException e) {
                collecting.remove(playerId);
                plugin.getLogger().log(Level.WARNING, "Could not collect order " + order.id(), e);
                player.sendMessage(messages.get("pickup.failed"));
                return;
            }
            if (units == null) {
                collecting.remove(playerId);
                player.sendMessage(messages.get("pickup.already", tags));
                return;
            }
            handOver(playerId, player.getName(), order, units, tags);
        });
    }

    private void handOver(UUID playerId, String playerName, ReadyOrder order, List<byte[]> units, TagResolver tags) {
        if (!plugin.isEnabled()) {
            collecting.remove(playerId);
            logUndelivered(playerName, order, units);
            return;
        }
        runOnMainThread(() -> {
            collecting.remove(playerId);
            Player player = plugin.getServer().getPlayer(playerId);
            if (player == null) {
                logUndelivered(playerName, order, units);
                return;
            }
            List<ItemStack> items = new ArrayList<>();
            for (byte[] unit : units) {
                try {
                    items.add(ItemStack.deserializeBytes(unit));
                } catch (RuntimeException e) {
                    plugin.getLogger().log(Level.SEVERE, "Order " + order.id() + " has an unreadable unit; "
                            + "data (Base64): " + Base64.getEncoder().encodeToString(unit), e);
                }
            }
            player.getInventory().addItem(items.toArray(ItemStack[]::new)).values()
                    .forEach(leftover -> player.getWorld().dropItemNaturally(player.getLocation(), leftover));
            player.sendMessage(plugin.messages().get("pickup.collected", tags));
            plugin.sounds().play(player, Sounds.Event.SUCCESS);
        });
    }

    private Inventory buildMenu(List<ReadyOrder> orders, TagResolver lockerTag) {
        Messages messages = plugin.messages();
        List<ReadyOrder> shown = orders.size() > PickupMenu.SIZE ? orders.subList(0, PickupMenu.SIZE) : orders;
        PickupMenu menu = new PickupMenu(List.copyOf(shown));
        Inventory inventory = plugin.getServer().createInventory(menu, PickupMenu.SIZE,
                messages.plain("pickup.menu-title", lockerTag));
        menu.attach(inventory);
        for (int slot = 0; slot < shown.size(); slot++) {
            inventory.setItem(slot, icon(shown.get(slot), messages));
        }
        return inventory;
    }

    /** The real item of the order (first unit) with the order details as lore. */
    private static ItemStack icon(ReadyOrder order, Messages messages) {
        ItemStack icon;
        try {
            icon = ItemStack.deserializeBytes(order.units().getFirst());
        } catch (RuntimeException e) {
            icon = new ItemStack(Material.BARRIER);
        }
        icon.editMeta(meta -> {
            meta.displayName(Component.text(order.title()).decoration(TextDecoration.ITALIC, false));
            meta.addItemFlags(ItemFlag.values());
            meta.lore(List.of(
                    lore(messages, "pickup.lore-shop", Placeholder.unparsed("shop", order.shopName())),
                    lore(messages, "pickup.lore-quantity",
                            Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                            Placeholder.unparsed("slots", String.valueOf(order.units().size()))),
                    lore(messages, "pickup.lore-click")));
        });
        return icon;
    }

    private static Component lore(Messages messages, String key, TagResolver... resolvers) {
        return messages.plain(key, resolvers).decoration(TextDecoration.ITALIC, false);
    }

    private static int freeSlots(Player player) {
        int free = 0;
        for (ItemStack item : player.getInventory().getStorageContents()) {
            if (item == null || item.isEmpty()) {
                free++;
            }
        }
        return free;
    }

    private void logUndelivered(String playerName, ReadyOrder order, List<byte[]> units) {
        StringBuilder data = new StringBuilder();
        for (byte[] unit : units) {
            data.append(System.lineSeparator()).append(Base64.getEncoder().encodeToString(unit));
        }
        plugin.getLogger().severe("Order " + order.id() + " is COLLECTED but its items could not be given to "
                + playerName + ". Restore them from this data (ItemStack#serializeAsBytes, Base64):" + data);
    }

    private void runOnMainThread(Runnable task) {
        plugin.getServer().getScheduler().runTask(plugin, task);
    }
}
