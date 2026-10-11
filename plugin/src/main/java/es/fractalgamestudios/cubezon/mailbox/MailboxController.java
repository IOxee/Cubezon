package es.fractalgamestudios.cubezon.mailbox;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.MailboxRepository;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.storage.SpecialItemShop;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.block.Container;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Personal mailboxes: placed anywhere by their owner, opened only by them (it shows their express
 * orders ready to collect), protected like every Cubezon block. Express delivery itself happens in
 * order processing; this class handles the block and publishes the express settings for the web.
 */
public final class MailboxController {

    private final CubezonPlugin plugin;
    private final MailboxRegistry registry = new MailboxRegistry();
    private final NamespacedKey itemKey;
    private final SpecialItemShop itemShop;
    /** Mailboxes whose removal is in flight, so a double break cannot drop two items. */
    private final Set<UUID> breaking = ConcurrentHashMap.newKeySet();

    public MailboxController(CubezonPlugin plugin) {
        this.plugin = plugin;
        this.itemKey = new NamespacedKey(plugin, "mailbox");
        this.itemShop = new SpecialItemShop(plugin, "mailbox", "mailbox", "mailbox", this::createItem);
    }

    /** config.yml mailbox.block; a block that falls or is not solid falls back to a dropper. */
    public Material blockMaterial() {
        Material material = Material.matchMaterial(plugin.getConfig().getString("mailbox.block", "dropper"));
        if (material == null || !material.isBlock() || !material.isItem() || !material.isSolid() || material.hasGravity()) {
            return Material.DROPPER;
        }
        return material;
    }

    public boolean expressEnabled() {
        return plugin.getConfig().getBoolean("mailbox.express.enabled", true);
    }

    public BigDecimal expressFee() {
        return BigDecimal.valueOf(Math.max(0, plugin.getConfig().getDouble("mailbox.express.fee", 100))).setScale(2,
                java.math.RoundingMode.HALF_UP);
    }

    public boolean feeToSeller() {
        return plugin.getConfig().getBoolean("mailbox.express.fee-to-seller", false);
    }

    /** Right click on a mailbox with an express package in hand delivers it. False when the item is not a package. */
    public boolean deliverPackage(org.bukkit.entity.Player player, Mailbox mailbox, org.bukkit.inventory.ItemStack item) {
        var roleplay = plugin.roleplayController();
        var label = roleplay.items().readPackage(item).orElse(null);
        if (label == null) {
            return false;
        }
        roleplay.deliverToMailbox(player, mailbox, label);
        return true;
    }

    /** Roleplay: express orders are carried to the buyer's mailbox by hand instead of arriving on their own. */
    public boolean handDelivery() {
        return plugin.getConfig().getBoolean("mailbox.express.hand-delivery", false);
    }

    public int maxPerPlayer() {
        return Math.clamp(plugin.getConfig().getInt("mailbox.max-per-player", 1), 0, 20);
    }

    /** Startup and /cz reload: what the web needs to offer express delivery. */
    public void publishSettings() {
        var roleplay = plugin.roleplay();
        if (roleplay == null) {
            return;
        }
        boolean enabled = expressEnabled();
        String fee = expressFee().toPlainString();
        int max = maxPerPlayer();
        plugin.dbExecutor().execute(() -> {
            try {
                roleplay.publishSetting("express_enabled", String.valueOf(enabled));
                roleplay.publishSetting("express_fee", fee);
                roleplay.publishSetting("max_mailboxes", String.valueOf(max));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not publish the mailbox settings", e);
            }
        });
    }

    public ItemStack createItem(int amount) {
        Messages messages = plugin.messages();
        ItemStack item = new ItemStack(blockMaterial(), amount);
        item.editMeta(meta -> {
            meta.displayName(messages.plain("mailbox.item-name").decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(
                    messages.plain("mailbox.item-lore-1").decoration(TextDecoration.ITALIC, false),
                    messages.plain("mailbox.item-lore-2").decoration(TextDecoration.ITALIC, false)));
            meta.getPersistentDataContainer().set(itemKey, PersistentDataType.BYTE, (byte) 1);
        });
        return item;
    }

    public boolean isMailboxItem(@Nullable ItemStack item) {
        return item != null && item.hasItemMeta()
                && item.getItemMeta().getPersistentDataContainer().has(itemKey, PersistentDataType.BYTE);
    }

    public SpecialItemShop itemShop() {
        return itemShop;
    }

    public void buy(Player player, int amount) {
        itemShop.buy(player, amount);
    }

    public void give(CommandSender sender, Player target, int amount) {
        itemShop.give(sender, target, amount);
    }

    public MailboxRegistry registry() {
        return registry;
    }

    public void refresh() {
        MailboxRepository mailboxes = plugin.mailboxes();
        if (mailboxes == null) {
            registry.replaceAll(List.of());
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                registry.replaceAll(mailboxes.findAll());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not refresh mailboxes", e);
            }
        });
    }

    /** /cz mailbox: where the player's mailboxes are. */
    public void info(Player player) {
        Messages messages = plugin.messages();
        List<Mailbox> own = registry.ownedBy(player.getUniqueId());
        if (own.isEmpty()) {
            player.sendMessage(messages.get("mailbox.none", Placeholder.unparsed("max", String.valueOf(maxPerPlayer()))));
            return;
        }
        for (Mailbox mailbox : own) {
            player.sendMessage(messages.get("mailbox.info", positionTags(mailbox.position())));
        }
    }

    public void handlePlace(BlockPlaceEvent event) {
        if (!isMailboxItem(event.getItemInHand())) {
            return;
        }
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        MailboxRepository mailboxes = plugin.mailboxes();
        if (mailboxes == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        if (registry.ownedBy(player.getUniqueId()).size() >= maxPerPlayer()) {
            event.setCancelled(true);
            player.sendMessage(messages.get("mailbox.limit", Placeholder.unparsed("max", String.valueOf(maxPerPlayer()))));
            return;
        }
        BlockPosition position = BlockPosition.of(event.getBlockPlaced());
        Material placed = event.getBlockPlaced().getType();
        UUID playerId = player.getUniqueId();
        String playerName = player.getName();
        plugin.dbExecutor().execute(() -> {
            try {
                var placement = mailboxes.place(playerId, playerName, position);
                if (placement.result() == MailboxRepository.PlaceResult.PLACED) {
                    registry.put(placement.mailbox());
                    player.sendMessage(messages.get("mailbox.placed", positionTags(position)));
                    return;
                }
                undoPlacement(player, position, placed, placement.result() == MailboxRepository.PlaceResult.LIMIT
                        ? messages.get("mailbox.limit", Placeholder.unparsed("max", String.valueOf(maxPerPlayer())))
                        : messages.get("mailbox.failed"));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not register the mailbox at " + position, e);
                undoPlacement(player, position, placed, messages.get("mailbox.failed"));
            }
        });
    }

    private void undoPlacement(Player player, BlockPosition position, Material placed, net.kyori.adventure.text.Component message) {
        runOnMainThread(() -> {
            Block block = blockAt(position);
            if (block != null && block.getType() == placed) {
                block.setType(Material.AIR);
            }
            if (player.isOnline()) {
                SpecialItemShop.giveOrDrop(player, createItem(1));
                player.sendMessage(message);
            }
        });
    }

    public void handleBreak(BlockBreakEvent event, Mailbox mailbox) {
        event.setCancelled(true);
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        if (!mailbox.ownerId().equals(player.getUniqueId()) && !Perm.ADMIN_BYPASS.has(player)) {
            player.sendMessage(messages.get("mailbox.not-yours", Placeholder.unparsed("owner", mailbox.ownerName())));
            return;
        }
        MailboxRepository mailboxes = plugin.mailboxes();
        if (mailboxes == null || !breaking.add(mailbox.id())) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                var result = mailboxes.remove(mailbox.id());
                if (result == MailboxRepository.RemoveResult.HAS_ORDERS) {
                    breaking.remove(mailbox.id());
                    player.sendMessage(messages.get("mailbox.has-orders"));
                    return;
                }
                registry.remove(mailbox.id());
                runOnMainThread(() -> {
                    breaking.remove(mailbox.id());
                    if (result != MailboxRepository.RemoveResult.REMOVED) {
                        return;
                    }
                    Block block = blockAt(mailbox.position());
                    if (block != null && !block.isEmpty()) {
                        if (block.getState() instanceof Container container) {
                            container.getInventory().clear();
                        }
                        block.setType(Material.AIR);
                        block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5), createItem(1));
                    }
                    player.sendMessage(messages.get("mailbox.removed"));
                });
            } catch (SQLException e) {
                breaking.remove(mailbox.id());
                plugin.getLogger().log(Level.WARNING, "Could not remove mailbox " + mailbox.id(), e);
                player.sendMessage(messages.get("mailbox.failed"));
            }
        });
    }

    /** Right click: the owner sees their express orders ready to collect. */
    public void open(Player player, Mailbox mailbox) {
        if (!mailbox.ownerId().equals(player.getUniqueId())) {
            player.sendMessage(plugin.messages().get("mailbox.of-player", Placeholder.unparsed("owner", mailbox.ownerName())));
            return;
        }
        plugin.pickupController().openMailbox(player, mailbox);
    }

    private Block blockAt(BlockPosition position) {
        var world = plugin.getServer().getWorld(position.world());
        return world == null ? null : world.getBlockAt(position.x(), position.y(), position.z());
    }

    private void runOnMainThread(Runnable task) {
        if (plugin.isEnabled()) {
            plugin.getServer().getScheduler().runTask(plugin, task);
        }
    }

    public static TagResolver positionTags(BlockPosition position) {
        return TagResolver.resolver(
                Placeholder.unparsed("world", position.world()),
                Placeholder.unparsed("x", String.valueOf(position.x())),
                Placeholder.unparsed("y", String.valueOf(position.y())),
                Placeholder.unparsed("z", String.valueOf(position.z())));
    }
}
