package es.fractalgamestudios.cubezon.storage;

import org.bukkit.Material;

import java.math.BigDecimal;

/**
 * A kind of storage block defined by an admin: which block it is, how many units it adds to the
 * shop and what it costs. {@code buyable} false = retired (no longer sold; placed ones still work).
 */
public record StorageType(String id, String displayName, Material material, int capacity, BigDecimal price,
                          boolean buyable) {

    /** The type every shop had before types existed; used when the database has none. */
    public static final String DEFAULT_ID = "barrel";

    public static StorageType fallback() {
        return new StorageType(DEFAULT_ID, "Almacén Cubezon", Material.BARREL, 27, BigDecimal.valueOf(1000), true);
    }

    /** Type ids: lowercase letters, digits, - and _, 2 to 32 characters (same rule as the database). */
    public static boolean isValidId(String id) {
        return id.matches("^[a-z0-9_-]{2,32}$");
    }
}
