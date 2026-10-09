package es.fractalgamestudios.cubezon.deposit;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;

/** Empty chest where the seller drops the units of one listing. Processed when it closes. */
public final class DepositMenu implements InventoryHolder {

    public static final int SIZE = 36;

    private final DepositableListing listing;
    private Inventory inventory;
    private boolean processed;

    DepositMenu(DepositableListing listing) {
        this.listing = listing;
    }

    void attach(Inventory inventory) {
        this.inventory = inventory;
    }

    public DepositableListing listing() {
        return listing;
    }

    /** Guards against processing the same contents twice. */
    boolean markProcessed() {
        if (processed) {
            return false;
        }
        processed = true;
        return true;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
