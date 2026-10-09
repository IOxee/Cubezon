package es.fractalgamestudios.cubezon.deposit;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.List;

/** Read-only menu: one icon per depositable listing. Clicking one opens its DepositMenu. */
public final class ListingMenu implements InventoryHolder {

    public static final int SIZE = 54;

    private final List<DepositableListing> listings;
    private Inventory inventory;

    ListingMenu(List<DepositableListing> listings) {
        this.listings = listings;
    }

    void attach(Inventory inventory) {
        this.inventory = inventory;
    }

    public @Nullable DepositableListing listingAt(int slot) {
        return slot >= 0 && slot < listings.size() ? listings.get(slot) : null;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}
