package es.fractalgamestudios.cubezon.gui;

import net.kyori.adventure.text.Component;
import org.bukkit.Server;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.Map;

/**
 * A read-only menu made of buttons: each slot can hold an icon and an action. Players can never
 * take or put items in it ({@link GuiListener} cancels every click); a click on a button runs its
 * action on the next tick, so actions may close or open other inventories safely.
 */
public final class Gui implements InventoryHolder {

    /** What a button does. {@code click} tells left from right and shift clicks. */
    @FunctionalInterface
    public interface Action {
        void run(Player player, ClickType click);
    }

    private final Inventory inventory;
    private final Map<Integer, Action> actions = new HashMap<>();

    public Gui(Server server, int rows, Component title) {
        this.inventory = server.createInventory(this, rows * 9, title);
    }

    /** An icon without action (information). A slot outside the menu (e.g. -1 in menus.yml) hides it. */
    public Gui set(int slot, ItemStack icon) {
        if (slot < 0 || slot >= inventory.getSize()) {
            return this;
        }
        inventory.setItem(slot, icon);
        actions.remove(slot);
        return this;
    }

    public Gui set(int slot, ItemStack icon, Action action) {
        if (slot < 0 || slot >= inventory.getSize()) {
            return this;
        }
        inventory.setItem(slot, icon);
        actions.put(slot, action);
        return this;
    }

    public int size() {
        return inventory.getSize();
    }

    /** Fills every empty slot with {@code filler} (no action); null does nothing. */
    public Gui fill(@Nullable ItemStack filler) {
        if (filler != null) {
            for (int slot = 0; slot < inventory.getSize(); slot++) {
                if (inventory.getItem(slot) == null) {
                    inventory.setItem(slot, filler);
                }
            }
        }
        return this;
    }

    public void open(Player player) {
        player.openInventory(inventory);
    }

    Action actionAt(int slot) {
        return actions.get(slot);
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
