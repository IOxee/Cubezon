package es.fractalgamestudios.cubezon.pickup;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.plugin.Plugin;

/** The pickup menu is read-only: every click is cancelled; a click on an order collects it. */
public final class PickupMenuListener implements Listener {

    private final Plugin plugin;
    private final PickupController controller;

    public PickupMenuListener(Plugin plugin, PickupController controller) {
        this.plugin = plugin;
        this.controller = controller;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        Inventory top = event.getView().getTopInventory();
        if (!(top.getHolder(false) instanceof PickupMenu menu)) {
            return;
        }
        event.setCancelled(true);
        if (event.getClickedInventory() != top || !(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        ReadyOrder order = menu.orderAt(event.getSlot());
        if (order != null) {
            // Closing or changing inventories inside a click handler is unsafe; do it next tick.
            plugin.getServer().getScheduler().runTask(plugin, () -> controller.collect(player, order));
        }
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder(false) instanceof PickupMenu) {
            event.setCancelled(true);
        }
    }
}
