package es.fractalgamestudios.cubezon.roleplay;

import org.jetbrains.annotations.Nullable;

import java.util.Locale;
import java.util.UUID;

/**
 * The two company computers ({@code shop_computers.kind}). FULL is the shop's control panel and only
 * goes inside the shop's zone. DELIVERY is a terminal that only prints the packages of accepted
 * orders; it can go anywhere (a depot far from the shop) except another shop's zone, and its item
 * carries the shop it belongs to.
 */
public enum ComputerKind {
    FULL, DELIVERY;

    /** Why a computer may not go where it was placed. */
    public enum Placement { OK, OUTSIDE_ZONE, OTHER_SHOP_ZONE, NOT_BOUND }

    /**
     * @param zoneShop  the shop whose zone the block is in, or null outside every zone
     * @param boundShop the shop a delivery terminal item belongs to (ignored for FULL)
     */
    public Placement placement(@Nullable UUID zoneShop, @Nullable UUID boundShop) {
        if (this == FULL) {
            return zoneShop == null ? Placement.OUTSIDE_ZONE : Placement.OK;
        }
        if (boundShop == null) {
            return Placement.NOT_BOUND;
        }
        return zoneShop != null && !zoneShop.equals(boundShop) ? Placement.OTHER_SHOP_ZONE : Placement.OK;
    }

    /** Staff, products, storage, commission and order decisions: only the full computer. */
    public boolean managesShop() {
        return this == FULL;
    }

    public static ComputerKind parse(@Nullable String raw) {
        return raw != null && raw.strip().toUpperCase(Locale.ROOT).equals("DELIVERY") ? DELIVERY : FULL;
    }
}
