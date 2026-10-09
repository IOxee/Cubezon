package es.fractalgamestudios.cubezon.locker;

import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import es.fractalgamestudios.cubezon.gui.InteractRules;
import es.fractalgamestudios.cubezon.i18n.Messages;
import org.bukkit.block.Block;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;

import java.util.List;
import java.util.function.Supplier;

/** Right click opens the pickup; locker blocks cannot be broken or blown up. */
public final class LockerListener implements Listener {

    private final LockerController controller;
    private final Supplier<Messages> messages;

    public LockerListener(LockerController controller, Supplier<Messages> messages) {
        this.controller = controller;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Block block = event.getClickedBlock();
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK || block == null) {
            return;
        }
        Locker locker = controller.registry().at(BlockPosition.of(block));
        if (locker == null || InteractRules.passesThrough(event)) {
            return;
        }
        // The block's own behaviour (e.g. opening a chest) never runs on a locker.
        event.setUseInteractedBlock(Event.Result.DENY);
        event.setUseItemInHand(Event.Result.DENY);
        if (event.getHand() == EquipmentSlot.HAND) {
            controller.openPickup(event.getPlayer(), locker);
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        Locker locker = controller.registry().at(BlockPosition.of(event.getBlock()));
        if (locker != null) {
            event.setCancelled(true);
            event.getPlayer().sendMessage(messages.get().get("locker.protected",
                    Placeholder.unparsed("name", locker.name())));
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

    private void protect(List<Block> blocks) {
        blocks.removeIf(block -> controller.registry().at(BlockPosition.of(block)) != null);
    }
}
