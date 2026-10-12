package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.database.RoleplayRepository;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.storage.ShopZone;
import es.fractalgamestudios.cubezon.storage.SpecialItemShop;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.Container;
import org.bukkit.entity.Player;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemStack;

import java.sql.SQLException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/** Placing and breaking company computers and delivery terminals. */
final class ComputerPlacement {

    private final CubezonPlugin plugin;
    private final RoleplayKit kit;
    private final ComputerRegistry registry;
    private final RoleplayItems items;
    /** Computers placed but not yet registered in the database (see handlePlace). */
    private final Set<BlockPosition> pendingPlacements = ConcurrentHashMap.newKeySet();
    /** Computers whose removal is in flight, so a double break cannot drop two items. */
    private final Set<UUID> breaking = ConcurrentHashMap.newKeySet();

    ComputerPlacement(CubezonPlugin plugin, RoleplayKit kit, ComputerRegistry registry, RoleplayItems items) {
        this.plugin = plugin;
        this.kit = kit;
        this.registry = registry;
        this.items = items;
    }

    /**
     * A full computer goes inside its shop's zone and only the owner places it. A delivery terminal
     * goes anywhere except another shop's zone; its shop's owner or anyone there with orders.package
     * places it (checked in the database, so the block is taken back if they may not).
     */
    void handlePlace(BlockPlaceEvent event) {
        ItemStack hand = event.getItemInHand();
        if (!items.isComputer(hand)) {
            return;
        }
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        BlockPosition position = BlockPosition.of(event.getBlockPlaced());
        ShopZone zone = plugin.storageController().registry().zoneAt(position).orElse(null);
        RoleplayItems.TerminalShop terminal = items.terminalShop(hand).orElse(null);
        ComputerKind kind = terminal == null ? ComputerKind.FULL : ComputerKind.DELIVERY;
        ComputerKind.Placement placement = kind.placement(zone == null ? null : zone.shopId(),
                terminal == null ? null : terminal.shopId());
        if (placement != ComputerKind.Placement.OK) {
            event.setCancelled(true);
            player.sendMessage(placement == ComputerKind.Placement.OTHER_SHOP_ZONE && zone != null
                    ? messages.get("computer.delivery.other-zone", Placeholder.unparsed("shop", zone.shopName()))
                    : messages.get("computer.outside-zone"));
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        if (kind == ComputerKind.FULL && !zone.ownerId().equals(playerId) && !admin) {
            event.setCancelled(true);
            player.sendMessage(messages.get("storage.not-yours", Placeholder.unparsed("shop", zone.shopName())));
            return;
        }
        UUID shopId = terminal == null ? zone.shopId() : terminal.shopId();
        String shopName = terminal == null ? zone.shopName() : terminal.shopName();
        TagResolver shopTag = Placeholder.unparsed("shop", shopName);
        Placed placed = new Placed(player, position, event.getBlockPlaced().getType(), hand.asOne());
        pendingPlacements.add(position);
        plugin.dbExecutor().execute(() -> {
            try {
                if (kind == ComputerKind.DELIVERY && !admin
                        && !roleplay.can(shopId, playerId, ShopPermission.ORDERS_PACKAGE.key())) {
                    undoPlacement(placed, messages.get("computer.delivery.not-staff", shopTag));
                    return;
                }
                registry.put(roleplay.insertComputer(shopId, shopName, position, playerId, kind));
                pendingPlacements.remove(position);
                player.sendMessage(messages.get(kind == ComputerKind.FULL ? "computer.placed" : "computer.delivery.placed", shopTag));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not register the computer at " + position, e);
                undoPlacement(placed, messages.get("computer.place-failed"));
            }
        });
    }

    /** A computer still being registered: it cannot be broken or pushed until the database answers. */
    boolean isPending(BlockPosition position) {
        return pendingPlacements.contains(position);
    }

    /** A computer block just placed, and the item to give back if it cannot stay. */
    private record Placed(Player player, BlockPosition position, Material type, ItemStack item) {
    }

    /**
     * Database thread. Takes the block back and returns the item (dropped there if the player left).
     * The item only comes back if the block was really taken back: never a block and an item.
     */
    private void undoPlacement(Placed placed, Component message) {
        kit.runOnMainThread(() -> {
            pendingPlacements.remove(placed.position());
            Block block = kit.blockAt(placed.position());
            if (block == null || block.getType() != placed.type()) {
                plugin.getLogger().warning("Computer at " + placed.position() + " was not registered and its block is gone;"
                        + " nothing returned to " + placed.player().getName() + ".");
                return;
            }
            block.setType(Material.AIR);
            if (placed.player().isOnline()) {
                SpecialItemShop.giveOrDrop(placed.player(), placed.item());
                placed.player().sendMessage(message);
            } else {
                block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5), placed.item());
            }
        });
    }

    /** The item a placed computer turns back into when broken. */
    private ItemStack itemOf(ComputerBlock computer) {
        return computer.kind() == ComputerKind.FULL
                ? items.computer(1, plugin.messages())
                : items.deliveryTerminal(1, new RoleplayItems.TerminalShop(computer.shopId(), computer.shopName()), plugin.messages());
    }

    void handleBreak(BlockBreakEvent event, ComputerBlock computer) {
        event.setCancelled(true);
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        TagResolver shopTag = Placeholder.unparsed("shop", computer.shopName());
        boolean trusted = Perm.ADMIN_BYPASS.has(player) || plugin.storageController().registry().zoneOf(computer.shopId())
                .map(zone -> zone.ownerId().equals(player.getUniqueId()))
                .orElse(false);
        // The full computer: owner or admin. A delivery terminal: also whoever may carry packages there.
        if (!trusted && computer.kind() == ComputerKind.FULL) {
            player.sendMessage(messages.get("computer.break-denied", shopTag));
            return;
        }
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null || !breaking.add(computer.id())) {
            return;
        }
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            try {
                if (!trusted && !roleplay.can(computer.shopId(), playerId, ShopPermission.ORDERS_PACKAGE.key())) {
                    breaking.remove(computer.id());
                    player.sendMessage(messages.get("computer.break-denied", shopTag));
                    return;
                }
                boolean deleted = roleplay.deleteComputer(computer.id());
                registry.remove(computer.id());
                kit.runOnMainThread(() -> {
                    breaking.remove(computer.id());
                    if (!deleted) {
                        return;
                    }
                    Block block = kit.blockAt(computer.position());
                    if (block != null && !block.isEmpty()) {
                        if (block.getState() instanceof Container container) {
                            container.getInventory().clear();
                        }
                        block.setType(Material.AIR);
                        block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5), itemOf(computer));
                    }
                    player.sendMessage(messages.get("computer.removed", shopTag));
                });
            } catch (SQLException e) {
                breaking.remove(computer.id());
                plugin.getLogger().log(Level.WARNING, "Could not remove computer " + computer.id(), e);
                player.sendMessage(messages.get("computer.failed"));
            }
        });
    }
}
