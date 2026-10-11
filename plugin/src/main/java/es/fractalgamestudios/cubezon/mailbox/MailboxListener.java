package es.fractalgamestudios.cubezon.mailbox;

import es.fractalgamestudios.cubezon.gui.InteractRules;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.bukkit.block.Block;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockDispenseEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.inventory.InventoryMoveItemEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;

import java.util.List;

/** Mailbox blocks: placement, protected breaking, right click to collect, never used as a container. */
public final class MailboxListener implements Listener {

    private final MailboxController controller;

    public MailboxListener(MailboxController controller) {
        this.controller = controller;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        controller.handlePlace(event);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        Mailbox mailbox = controller.registry().at(BlockPosition.of(event.getBlock()));
        if (mailbox != null) {
            controller.handleBreak(event, mailbox);
        }
    }

    /** Sneaking with something in hand is left to vanilla (blocks can be placed against it). */
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Block clicked = event.getClickedBlock();
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || clicked == null) {
            return;
        }
        Mailbox mailbox = controller.registry().at(BlockPosition.of(clicked));
        if (mailbox == null || InteractRules.passesThrough(event)) {
            return;
        }
        event.setUseInteractedBlock(Event.Result.DENY);
        event.setUseItemInHand(Event.Result.DENY);
        if (event.getHand() == EquipmentSlot.HAND
                && !controller.deliverPackage(event.getPlayer(), mailbox, event.getItem())) {
            controller.open(event.getPlayer(), mailbox);
        }
    }

    /** A dropper or dispenser mailbox must never fire items with redstone. */
    @EventHandler(ignoreCancelled = true)
    public void onDispense(BlockDispenseEvent event) {
        if (controller.registry().at(BlockPosition.of(event.getBlock())) != null) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onMoveItem(InventoryMoveItemEvent event) {
        if (isMailbox(event.getSource()) || isMailbox(event.getDestination())) {
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

    private boolean isMailbox(Inventory inventory) {
        var location = inventory.getLocation();
        return location != null && location.getWorld() != null
                && controller.registry().at(BlockPosition.of(location.getBlock())) != null;
    }

    private void protect(List<Block> blocks) {
        blocks.removeIf(block -> controller.registry().at(BlockPosition.of(block)) != null);
    }
}
