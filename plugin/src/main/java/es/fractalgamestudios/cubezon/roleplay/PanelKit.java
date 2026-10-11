package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.ShopInfo;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.storage.StorageController;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.List;
import java.util.function.Consumer;
import java.util.logging.Level;

/**
 * What the company computer's screens share: loading off the main thread, the shop's tags, the
 * back button, limits from config.yml and the way back to the panel itself.
 */
final class PanelKit {

    static final int LIST_SLOTS = 45;
    static final int BACK_SLOT = 49;

    interface Load<T> {
        T load() throws SQLException;
    }

    private final CubezonPlugin plugin;
    private final ComputerPanel panel;
    /** Slots and icons of the buttons (menus.yml). */
    private final MenuLayout menu;

    PanelKit(CubezonPlugin plugin, ComputerPanel panel, MenuLayout menu) {
        this.plugin = plugin;
        this.panel = panel;
        this.menu = menu;
    }

    /** Opens the panel again from the start (access and permissions are loaded again). */
    void open(Player player, ComputerBlock computer) {
        panel.open(player, computer);
    }

    void showMain(Player player, PanelContext context) {
        panel.showMain(player, context);
    }

    /** Back to the main screen; a delivery terminal has none, so there it closes. */
    void back(Gui gui, PanelContext context) {
        if (!context.computer().kind().managesShop()) {
            gui.set(menu.slot("common.back", BACK_SLOT), Icons.decorate(menu.icon("main.close", Material.BARRIER), plugin.messages(), "panel.close", List.of()),
                    (p, click) -> p.closeInventory());
            return;
        }
        gui.set(menu.slot("common.back", BACK_SLOT), Icons.decorate(menu.icon("common.back", Material.ARROW), plugin.messages(), "panel.back", List.of()),
                (p, click) -> open(p, context.computer()));
    }

    /** config.yml settings.max-purchase-amount (1-256). */
    int maxPurchase() {
        return Math.clamp(plugin.getConfig().getInt("settings.max-purchase-amount", StorageController.MAX_AMOUNT), 1,
                StorageController.MAX_AMOUNT);
    }

    String money(BigDecimal amount) {
        Economy economy = plugin.economy();
        return economy == null ? amount.toPlainString() : economy.format(amount.doubleValue());
    }

    static String shorten(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max - 1).stripTrailing() + "…";
    }

    static boolean isRight(ClickType click) {
        return click == ClickType.RIGHT || click == ClickType.SHIFT_RIGHT;
    }

    TagResolver shopTags(ShopInfo shop) {
        Messages messages = plugin.messages();
        return TagResolver.resolver(
                Placeholder.unparsed("shop", shop.name()),
                Placeholder.unparsed("shop_short", shorten(shop.name(), Math.clamp(plugin.getConfig().getInt("settings.menu-title-name-length", 22), 8, 40))),
                Placeholder.unparsed("slug", shop.slug()),
                Placeholder.unparsed("owner", shop.ownerName()),
                Placeholder.unparsed("status", shop.status()),
                Placeholder.component("zone", messages.plain(shop.hasZone() ? "panel.shop.zone-yes" : "panel.shop.zone-no")),
                Placeholder.unparsed("mode", plugin.orderMode().key()),
                Placeholder.unparsed("used", String.valueOf(shop.usedUnits())),
                Placeholder.unparsed("capacity", String.valueOf(shop.capacityUnits())),
                Placeholder.unparsed("blocks", String.valueOf(shop.storageBlocks())),
                Placeholder.unparsed("members", String.valueOf(shop.members())));
    }

    /** Loads off the main thread, then continues on it (only if the player is still online). */
    <T> void async(Player player, Load<T> load, Consumer<T> then) {
        plugin.dbExecutor().execute(() -> {
            T value;
            try {
                value = load.load();
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Computer panel query failed", e);
                player.sendMessage(plugin.messages().get("computer.failed"));
                return;
            }
            if (plugin.isEnabled()) {
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (player.isOnline()) {
                        then.accept(value);
                    }
                });
            }
        });
    }
}
