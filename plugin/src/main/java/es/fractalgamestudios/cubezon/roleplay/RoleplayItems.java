package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.Nullable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Roleplay items, recognised by their PDC tags (a renamed vanilla item never counts):
 * the company computer (a crafter) and the package an employee carries to the locker.
 * A package holds no items, only the order it delivers: copying it is useless, because an order
 * can only be delivered once.
 */
public final class RoleplayItems {

    /**
     * The order a package delivers and where: a locker, or (express with hand delivery) the buyer's mailbox.
     * {@code targetId} is the locker or mailbox id and {@code targetName} the locker's name or the mailbox owner's.
     */
    public record PackageLabel(UUID orderId, UUID targetId, String targetName, String title, boolean mailbox) {
    }

    /** The shop a delivery terminal item belongs to. */
    public record TerminalShop(UUID shopId, String shopName) {
    }

    private final Plugin plugin;
    private final NamespacedKey computerKey;
    private final NamespacedKey terminalShopKey;
    private final NamespacedKey terminalShopNameKey;
    private final NamespacedKey orderKey;
    private final NamespacedKey lockerKey;
    private final NamespacedKey lockerNameKey;
    private final NamespacedKey titleKey;
    private final NamespacedKey mailboxKey;

    public RoleplayItems(Plugin plugin) {
        this.plugin = plugin;
        this.computerKey = new NamespacedKey(plugin, "company_computer");
        this.terminalShopKey = new NamespacedKey(plugin, "terminal_shop");
        this.terminalShopNameKey = new NamespacedKey(plugin, "terminal_shop_name");
        this.orderKey = new NamespacedKey(plugin, "package_order");
        this.lockerKey = new NamespacedKey(plugin, "package_locker");
        this.lockerNameKey = new NamespacedKey(plugin, "package_locker_name");
        this.titleKey = new NamespacedKey(plugin, "package_title");
        this.mailboxKey = new NamespacedKey(plugin, "package_mailbox");
    }

    /** config.yml computer.block: any solid block that does not fall; crafter by default. */
    public Material computerBlock() {
        Material material = Material.matchMaterial(plugin.getConfig().getString("computer.block", "crafter"));
        return material != null && material.isBlock() && material.isItem() && material.isSolid() && !material.hasGravity()
                ? material : Material.CRAFTER;
    }

    /** config.yml computer.package-material: an item that cannot be placed; paper by default. */
    public Material packageMaterial() {
        Material material = Material.matchMaterial(plugin.getConfig().getString("computer.package-material", "paper"));
        return material != null && material.isItem() && !material.isBlock() ? material : Material.PAPER;
    }

    public ItemStack computer(int amount, Messages messages) {
        ItemStack item = new ItemStack(computerBlock(), amount);
        item.editMeta(meta -> {
            meta.displayName(messages.plain("computer.item-name").decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(
                    messages.plain("computer.item-lore-1").decoration(TextDecoration.ITALIC, false),
                    messages.plain("computer.item-lore-2").decoration(TextDecoration.ITALIC, false)));
            meta.getPersistentDataContainer().set(computerKey, PersistentDataType.BYTE, (byte) 1);
        });
        return item;
    }

    /** config.yml computer.delivery.block, with the same rules as computer.block; cartography table by default. */
    public Material terminalBlock() {
        Material material = Material.matchMaterial(plugin.getConfig().getString("computer.delivery.block", "cartography_table"));
        return material != null && material.isBlock() && material.isItem() && material.isSolid() && !material.hasGravity()
                ? material : Material.CARTOGRAPHY_TABLE;
    }

    /** A delivery terminal of one shop: it only prints that shop's packages, and may stand outside its zone. */
    public ItemStack deliveryTerminal(int amount, TerminalShop shop, Messages messages) {
        ItemStack item = new ItemStack(terminalBlock(), amount);
        item.editMeta(meta -> {
            var shopTag = Placeholder.unparsed("shop", shop.shopName());
            meta.displayName(messages.plain("computer.delivery.item-name", shopTag).decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(
                    messages.plain("computer.delivery.item-lore-1", shopTag).decoration(TextDecoration.ITALIC, false),
                    messages.plain("computer.delivery.item-lore-2", shopTag).decoration(TextDecoration.ITALIC, false)));
            PersistentDataContainer data = meta.getPersistentDataContainer();
            data.set(terminalShopKey, PersistentDataType.STRING, shop.shopId().toString());
            data.set(terminalShopNameKey, PersistentDataType.STRING, shop.shopName());
        });
        return item;
    }

    /** The full computer or a delivery terminal. */
    public boolean isComputer(@Nullable ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return false;
        }
        PersistentDataContainer data = item.getItemMeta().getPersistentDataContainer();
        return data.has(computerKey, PersistentDataType.BYTE) || data.has(terminalShopKey, PersistentDataType.STRING);
    }

    /** The shop of a delivery terminal item; empty for the full computer or anything else. */
    public Optional<TerminalShop> terminalShop(@Nullable ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return Optional.empty();
        }
        PersistentDataContainer data = item.getItemMeta().getPersistentDataContainer();
        String shopId = data.get(terminalShopKey, PersistentDataType.STRING);
        if (shopId == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(new TerminalShop(UUID.fromString(shopId),
                    data.getOrDefault(terminalShopNameKey, PersistentDataType.STRING, "")));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public ItemStack packageFor(PackageLabel label, int quantity, Messages messages) {
        ItemStack item = new ItemStack(packageMaterial());
        item.editMeta(meta -> {
            var title = Placeholder.unparsed("title", label.title());
            var locker = Placeholder.unparsed("locker", label.targetName());
            meta.displayName(messages.plain("computer.package-name", title).decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(
                    messages.plain("computer.package-lore-1", title,
                            Placeholder.unparsed("quantity", String.valueOf(quantity))).decoration(TextDecoration.ITALIC, false),
                    messages.plain(label.mailbox() ? "computer.package-lore-mailbox" : "computer.package-lore-2", locker)
                            .decoration(TextDecoration.ITALIC, false)));
            meta.setEnchantmentGlintOverride(true);
            meta.setMaxStackSize(1);
            PersistentDataContainer data = meta.getPersistentDataContainer();
            data.set(orderKey, PersistentDataType.STRING, label.orderId().toString());
            data.set(lockerKey, PersistentDataType.STRING, label.targetId().toString());
            data.set(lockerNameKey, PersistentDataType.STRING, label.targetName());
            data.set(titleKey, PersistentDataType.STRING, label.title());
            data.set(mailboxKey, PersistentDataType.BYTE, (byte) (label.mailbox() ? 1 : 0));
        });
        return item;
    }

    public Optional<PackageLabel> readPackage(@Nullable ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return Optional.empty();
        }
        PersistentDataContainer data = item.getItemMeta().getPersistentDataContainer();
        String orderId = data.get(orderKey, PersistentDataType.STRING);
        String lockerId = data.get(lockerKey, PersistentDataType.STRING);
        if (orderId == null || lockerId == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(new PackageLabel(UUID.fromString(orderId), UUID.fromString(lockerId),
                    data.getOrDefault(lockerNameKey, PersistentDataType.STRING, ""),
                    data.getOrDefault(titleKey, PersistentDataType.STRING, ""),
                    data.getOrDefault(mailboxKey, PersistentDataType.BYTE, (byte) 0) == 1));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** Removes every package of that order from the player's inventory and cursor. */
    public void removePackages(Player player, UUID orderId) {
        var inventory = player.getInventory();
        for (int slot = 0; slot < inventory.getSize(); slot++) {
            if (readPackage(inventory.getItem(slot)).filter(label -> label.orderId().equals(orderId)).isPresent()) {
                inventory.setItem(slot, null);
            }
        }
        if (readPackage(player.getItemOnCursor()).filter(label -> label.orderId().equals(orderId)).isPresent()) {
            player.setItemOnCursor(null);
        }
        player.updateInventory();
    }
}
