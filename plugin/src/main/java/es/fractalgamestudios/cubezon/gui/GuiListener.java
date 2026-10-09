package es.fractalgamestudios.cubezon.gui;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.plugin.Plugin;

/** Makes every {@link Gui} read-only and dispatches button clicks. */
public final class GuiListener implements Listener {

    private final Plugin plugin;
    private final Sounds sounds;

    public GuiListener(Plugin plugin, Sounds sounds) {
        this.plugin = plugin;
        this.sounds = sounds;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        Inventory top = event.getView().getTopInventory();
        if (!(top.getHolder(false) instanceof Gui gui)) {
            return;
        }
        event.setCancelled(true);
        if (event.getClickedInventory() != top || !(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        Gui.Action action = gui.actionAt(event.getSlot());
        if (action != null) {
            sounds.play(player, Sounds.Event.MENU_CLICK);
            var click = event.getClick();
            // Opening or closing inventories inside a click handler is unsafe; do it next tick.
            plugin.getServer().getScheduler().runTask(plugin, () -> action.run(player, click));
        }
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder(false) instanceof Gui) {
            event.setCancelled(true);
        }
    }
}
