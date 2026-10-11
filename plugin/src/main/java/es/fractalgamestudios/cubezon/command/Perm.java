package es.fractalgamestudios.cubezon.command;

import org.bukkit.permissions.Permissible;

/**
 * Every Bukkit permission node of the plugin. They are declared in plugin.yml (a test keeps both in sync), so
 * permission plugins list them and can grant them one by one. {@code cubezon.use} grants the player nodes and
 * {@code cubezon.admin} grants every admin node, so setting just the parent keeps working.
 */
public enum Perm {
    USE("cubezon.use", false),
    LINK("cubezon.link", false),
    DEPOSIT("cubezon.deposit", false),
    PICKUP("cubezon.pickup", false),
    BUY_COMPUTER("cubezon.buy.computer", false),
    BUY_MAILBOX("cubezon.buy.mailbox", false),
    BUY_STORAGE("cubezon.buy.storage", false),

    ADMIN("cubezon.admin", true),
    /** /cz computer|mailbox|storage give. */
    ADMIN_GIVE("cubezon.admin.give", true),
    /** /cz storage type create|remove|list. */
    ADMIN_STORAGE_TYPES("cubezon.admin.storage-types", true),
    /** /cz locker create|remove|list. */
    ADMIN_LOCKER("cubezon.admin.locker", true),
    /** /cz shop: zone wand and shop slots. */
    ADMIN_SHOP("cubezon.admin.shop", true),
    /** /cz item register. */
    ADMIN_ITEM("cubezon.admin.item", true),
    ADMIN_RELOAD("cubezon.admin.reload", true),
    /** The server owner's feature panel. */
    ADMIN_PANEL("cubezon.admin.panel", true),
    /** Creating and removing «Tienda Cubezon» kiosks (/cz kiosk). */
    ADMIN_TERMINAL("cubezon.admin.terminal", true),
    /** Works on any shop as if it were the owner: computers, orders, stock, staff. */
    ADMIN_BYPASS("cubezon.admin.bypass", true);

    private final String node;
    private final boolean adminOnly;

    Perm(String node, boolean adminOnly) {
        this.node = node;
        this.adminOnly = adminOnly;
    }

    public String node() {
        return node;
    }

    /** True for nodes that default to operators only. */
    public boolean adminOnly() {
        return adminOnly;
    }

    public boolean has(Permissible who) {
        return who.hasPermission(node);
    }
}
