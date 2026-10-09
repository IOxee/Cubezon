package es.fractalgamestudios.cubezon.deposit;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A listing of one of the player's approved shops that accepts deposits. {@code itemKey} says
 * which items count (see ItemIdentity); {@code material} is only the vanilla base, for the icon.
 */
public record DepositableListing(
        UUID id,
        String title,
        String shopName,
        String itemKey,
        String material,
        int unitAmount,
        BigDecimal unitPrice,
        int unitsAvailable,
        String matchMode,
        @Nullable byte[] sample) {

    /** EXACT listings only take items identical to their sample (same NBT). */
    public boolean exact() {
        return "EXACT".equals(matchMode) && sample != null;
    }
}
