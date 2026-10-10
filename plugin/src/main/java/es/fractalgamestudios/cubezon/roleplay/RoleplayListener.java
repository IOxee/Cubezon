package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.gui.InteractRules;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.locker.Locker;
import es.fractalgamestudios.cubezon.locker.LockerRegistry;
import org.bukkit.block.Block;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.block.CrafterCraftEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.inventory.InventoryMoveItemEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;
import org.bukkit.plugin.Plugin;

import java.util.List;

/** Company computers (place, break, open, protect) and package delivery at lockers. */
public final class RoleplayListener implements Listener {

    private final Plugin plugin;
    private final RoleplayController controller;
    private final LockerRegistry lockers;

    public RoleplayListener(Plugin plugin, RoleplayController controller, LockerRegistry lockers) {
        this.plugin = plugin;
        this.controller = controller;
        this.lockers = lockers;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        controller.handlePlace(event);
        // A package is paper, but never let a package-like block be placed.
        if (controller.items().readPackage(event.getItemInHand()).isPresent()) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        ComputerBlock computer = controller.registry().at(BlockPosition.of(event.getBlock()));
        if (computer != null) {
            controller.handleBreak(event, computer);
        }
    }

    /**
     * Right click: a package on its locker is delivered (before the locker opens its pickup menu);
     * a computer opens the shop panel. Sneaking with something in hand is left to vanilla, so blocks
     * can be placed against a computer.
     */
    @EventHandler(priority = EventPriority.NORMAL, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Block clicked = event.getClickedBlock();
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || clicked == null) {
            return;
        }
        BlockPosition position = BlockPosition.of(clicked);

        var label = controller.items().readPackage(event.getItem()).orElse(null);
        Locker locker = lockers.at(position);
        if (label != null && locker != null) {
            event.setCancelled(true);
            if (event.getHand() == EquipmentSlot.HAND) {
                controller.deliver(event.getPlayer(), locker, label);
            }
            return;
        }

        ComputerBlock computer = controller.registry().at(position);
        if (computer == null || InteractRules.passesThrough(event)) {
            return;
        }
        event.setUseInteractedBlock(Event.Result.DENY);
        event.setUseItemInHand(Event.Result.DENY);
        if (event.getHand() == EquipmentSlot.HAND) {
            controller.openComputer(event.getPlayer(), computer);
        }
    }

    /** A computer is a crafter: it must never take items from hoppers or craft. */
    @EventHandler(ignoreCancelled = true)
    public void onMoveItem(InventoryMoveItemEvent event) {
        if (isComputer(event.getSource()) || isComputer(event.getDestination())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onCraft(CrafterCraftEvent event) {
        if (controller.registry().at(BlockPosition.of(event.getBlock())) != null) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onEntityExplode(EntityExplodeEvent event) {
        protect(event.blockList());
    }

    @EventHandler(ignoreCancelled = true)
    public void onBlockExplode(BlockExplodeEvent event) {
        protect(event.blockList());
    }

    /** Any block can be the computer (config.yml computer.block), so check by location. */
    private boolean isComputer(Inventory inventory) {
        var location = inventory.getLocation();
        return location != null && location.getWorld() != null
                && controller.registry().at(BlockPosition.of(location.getBlock())) != null;
    }

    private void protect(List<Block> blocks) {
        blocks.removeIf(block -> controller.registry().at(BlockPosition.of(block)) != null);
    }
}
