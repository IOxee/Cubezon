package es.fractalgamestudios.cubezon.roles;

import org.bukkit.Material;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

/**
 * What a shop role may do. The keys are the ones stored in shop_roles.permissions and checked by
 * public.shop_member_can (keep both lists in sync). The owner always has all of them.
 */
public enum ShopPermission {
    ORDERS_DECIDE("orders.decide", Material.LIME_CONCRETE),
    ORDERS_PACKAGE("orders.package", Material.PAPER),
    STOCK_DEPOSIT("stock.deposit", Material.HOPPER),
    STOCK_WITHDRAW("stock.withdraw", Material.DROPPER),
    PRODUCTS_MANAGE("products.manage", Material.WRITABLE_BOOK),
    STAFF_MANAGE("staff.manage", Material.PLAYER_HEAD),
    STORAGE_BUY("storage.buy", Material.BARREL);

    private final String key;
    private final Material icon;

    ShopPermission(String key, Material icon) {
        this.key = key;
        this.icon = icon;
    }

    public String key() {
        return key;
    }

    public Material icon() {
        return icon;
    }

    /** Language key suffix: orders.decide -> orders-decide. */
    public String textKey() {
        return key.replace('.', '-');
    }

    public static Optional<ShopPermission> byKey(String key) {
        for (ShopPermission permission : values()) {
            if (permission.key.equals(key)) {
                return Optional.of(permission);
            }
        }
        return Optional.empty();
    }

    /** Known permissions among the given keys; unknown ones are ignored. */
    public static Set<ShopPermission> fromKeys(Collection<String> keys) {
        Set<ShopPermission> permissions = EnumSet.noneOf(ShopPermission.class);
        for (String key : keys) {
            byKey(key).ifPresent(permissions::add);
        }
        return permissions;
    }
}
