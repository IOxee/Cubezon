package es.fractalgamestudios.cubezon.kiosk;

import es.fractalgamestudios.cubezon.gui.InteractRules;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.bukkit.block.Block;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockPistonExtendEvent;
import org.bukkit.event.block.BlockPistonRetractEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;

import java.util.List;
import java.util.function.Supplier;

/** Right click opens the kiosk menu; kiosks cannot be broken, pushed or blown up (admins remove them by command). */
public final class KioskListener implements Listener {

    private final KioskController controller;
    private final Supplier<Messages> messages;

    public KioskListener(KioskController controller, Supplier<Messages> messages) {
        this.controller = controller;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Block block = event.getClickedBlock();
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || block == null
                || !controller.registry().contains(BlockPosition.of(block)) || InteractRules.passesThrough(event)) {
            return;
        }
        // The block's own behaviour (a chest opening, a crafting table...) never runs on a kiosk.
        event.setUseInteractedBlock(Event.Result.DENY);
        event.setUseItemInHand(Event.Result.DENY);
        if (event.getHand() == EquipmentSlot.HAND) {
            controller.open(event.getPlayer());
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        if (controller.registry().contains(BlockPosition.of(event.getBlock()))) {
            event.setCancelled(true);
            event.getPlayer().sendMessage(messages.get().get("kiosk.protected"));
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onPistonExtend(BlockPistonExtendEvent event) {
        if (anyKiosk(event.getBlocks())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onPistonRetract(BlockPistonRetractEvent event) {
        if (anyKiosk(event.getBlocks())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onEntityExplode(EntityExplodeEvent event) {
        event.blockList().removeIf(block -> controller.registry().contains(BlockPosition.of(block)));
    }

    @EventHandler(ignoreCancelled = true)
    public void onBlockExplode(BlockExplodeEvent event) {
        event.blockList().removeIf(block -> controller.registry().contains(BlockPosition.of(block)));
    }

    private boolean anyKiosk(List<Block> blocks) {
        return blocks.stream().anyMatch(block -> controller.registry().contains(BlockPosition.of(block)));
    }
}
