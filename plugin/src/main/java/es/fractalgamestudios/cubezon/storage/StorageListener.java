package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.gui.InteractRules;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.block.Block;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.inventory.InventoryMoveItemEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;

import java.util.List;
import java.util.function.Supplier;

/** Storage blocks of any type: placement inside the shop zone, protected breaking, never used as a container. */
public final class StorageListener implements Listener {

    private final StorageController controller;
    private final Supplier<Messages> messages;

    public StorageListener(StorageController controller, Supplier<Messages> messages) {
        this.controller = controller;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        controller.handlePlace(event);
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        StorageBlock block = controller.registry().blockAt(BlockPosition.of(event.getBlock()));
        if (block != null) {
            controller.handleBreak(event, block);
        }
    }

    /** Zone wand: left click marks corner 1, right click corner 2. Runs before anything else. */
    @EventHandler(priority = EventPriority.LOWEST)
    public void onWandUse(PlayerInteractEvent event) {
        var target = controller.wand().read(event.getItem()).orElse(null);
        if (target == null) {
            return;
        }
        event.setCancelled(true);
        Block clicked = event.getClickedBlock();
        if (clicked == null || event.getHand() != EquipmentSlot.HAND) {
            return;
        }
        if (event.getAction() == Action.LEFT_CLICK_BLOCK) {
            controller.markCorner(event.getPlayer(), target, BlockPosition.of(clicked), 1);
        } else if (event.getAction() == Action.RIGHT_CLICK_BLOCK) {
            controller.markCorner(event.getPlayer(), target, BlockPosition.of(clicked), 2);
        }
    }

    /** Left click with the wand must never break the block, not even in creative. */
    @EventHandler(priority = EventPriority.LOWEST)
    public void onWandBreak(BlockBreakEvent event) {
        if (controller.wand().read(event.getPlayer().getInventory().getItemInMainHand()).isPresent()) {
            event.setCancelled(true);
        }
    }

    /**
     * Right click never opens a storage barrel: it shows what the block is. Sneaking with something
     * in hand is left to vanilla, so blocks (e.g. another storage barrel) can be placed against it.
     */
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Block clicked = event.getClickedBlock();
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || clicked == null) {
            return;
        }
        StorageBlock block = controller.registry().blockAt(BlockPosition.of(clicked));
        if (block == null || InteractRules.passesThrough(event)) {
            return;
        }
        event.setUseInteractedBlock(Event.Result.DENY);
        event.setUseItemInHand(Event.Result.DENY);
        if (event.getHand() == EquipmentSlot.HAND) {
            event.getPlayer().sendMessage(messages.get().get("storage.info-block",
                    Placeholder.unparsed("shop", block.shopName()),
                    Placeholder.unparsed("capacity", String.valueOf(block.capacity()))));
        }
    }

    /** Hoppers must not put items into (or take them out of) a storage barrel. */
    @EventHandler(ignoreCancelled = true)
    public void onMoveItem(InventoryMoveItemEvent event) {
        if (isStorage(event.getSource()) || isStorage(event.getDestination())) {
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

    /** Any container block can be a storage type (barrel, chest...), so check by location. */
    private boolean isStorage(Inventory inventory) {
        var location = inventory.getLocation();
        return location != null && location.getWorld() != null
                && controller.registry().blockAt(BlockPosition.of(location.getBlock())) != null;
    }

    private void protect(List<Block> blocks) {
        blocks.removeIf(block -> controller.registry().blockAt(BlockPosition.of(block)) != null);
    }
}
