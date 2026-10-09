package es.fractalgamestudios.cubezon.deposit;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.plugin.Plugin;

/** Wires the deposit menus to inventory events. */
public final class DepositMenuListener implements Listener {

    private final Plugin plugin;
    private final DepositController controller;

    public DepositMenuListener(Plugin plugin, DepositController controller) {
        this.plugin = plugin;
        this.controller = controller;
    }

    /** The listing menu is read-only: every click is cancelled; a click on an icon opens its chest. */
    @EventHandler
    public void onClick(InventoryClickEvent event) {
        Inventory top = event.getView().getTopInventory();
        if (!(top.getHolder(false) instanceof ListingMenu menu)) {
            return;
        }
        event.setCancelled(true);
        if (event.getClickedInventory() != top || !(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        DepositableListing listing = menu.listingAt(event.getSlot());
        if (listing != null) {
            // Opening another inventory inside a click handler is unsafe; do it next tick.
            plugin.getServer().getScheduler().runTask(plugin, () -> controller.openDeposit(player, listing));
        }
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder(false) instanceof ListingMenu) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent event) {
        if (event.getInventory().getHolder(false) instanceof DepositMenu menu
                && event.getPlayer() instanceof Player player) {
            controller.handleClose(player, menu);
        }
    }
}
