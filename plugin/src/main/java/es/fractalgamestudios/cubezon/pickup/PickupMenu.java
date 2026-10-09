package es.fractalgamestudios.cubezon.pickup;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.List;

/** Read-only menu: one icon per READY order at a locker. Clicking one collects it. */
public final class PickupMenu implements InventoryHolder {

    public static final int SIZE = 54;

    private final List<ReadyOrder> orders;
    private Inventory inventory;

    PickupMenu(List<ReadyOrder> orders) {
        this.orders = orders;
    }

    void attach(Inventory inventory) {
        this.inventory = inventory;
    }

    public @Nullable ReadyOrder orderAt(int slot) {
        return slot >= 0 && slot < orders.size() ? orders.get(slot) : null;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
