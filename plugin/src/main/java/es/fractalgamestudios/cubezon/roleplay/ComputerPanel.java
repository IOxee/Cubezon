package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.RoleRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.ShopInfo;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.order.OrderMode;
import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.storage.StorageType;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The company computer: the shop's control panel. Staff (owner and employees) see orders, staff,
 * listings and storage; only the owner (or an admin) hires and fires, withdraws stock and sets
 * exact samples. Every screen loads its data off the main thread and opens on it.
 */
public final class ComputerPanel {

    private record Access(ShopInfo shop, Set<ShopPermission> permissions) {
    }

    private final CubezonPlugin plugin;
    private final RoleplayController orders;
    /** Slots and icons of the buttons (menus.yml). */
    private final MenuLayout menu;
    private final PanelKit kit;
    private final StaffScreens staff;
    private final ProductScreens products;
    private final ShopSettingsScreens settings;

    public ComputerPanel(CubezonPlugin plugin, RoleplayController orders) {
        this.plugin = plugin;
        this.orders = orders;
        this.menu = plugin.menuLayout();
        this.kit = new PanelKit(plugin, this, menu);
        this.staff = new StaffScreens(plugin, kit, menu);
        this.products = new ProductScreens(plugin, kit, menu);
        this.settings = new ShopSettingsScreens(plugin, orders, kit, menu);
    }

    public void open(Player player, ComputerBlock computer) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null || plugin.roleplay() == null) {
            player.sendMessage(plugin.messages().get("error.database-required"));
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        RoleRepository roles = plugin.roles();
        kit.async(player, () -> {
            if (!admin && !plugin.roleplay().canUse(computer.shopId(), playerId)) {
                return null;
            }
            ShopInfo shop = panel.shopInfo(computer.shopId()).orElse(null);
            if (shop == null) {
                return null;
            }
            Set<ShopPermission> permissions = admin || roles == null
                    ? (admin ? EnumSet.allOf(ShopPermission.class) : EnumSet.noneOf(ShopPermission.class))
                    : roles.permissionsOf(computer.shopId(), playerId);
            return new Access(shop, permissions);
        }, access -> {
            if (access == null) {
                player.sendMessage(plugin.messages().get("computer.not-staff",
                        Placeholder.unparsed("shop", computer.shopName())));
                return;
            }
            PanelContext context = new PanelContext(computer, access.shop(), admin || access.shop().ownerId().equals(playerId),
                    access.permissions());
            if (computer.kind().managesShop()) {
                showMain(player, context);
            } else if (plugin.orderMode() == OrderMode.ROLEPLAY && context.can(ShopPermission.ORDERS_PACKAGE)) {
                showOrders(player, context);
            } else {
                player.sendMessage(plugin.messages().get("computer.delivery.cannot-use",
                        Placeholder.unparsed("shop", computer.shopName())));
            }
        });
    }

    void showMain(Player player, PanelContext context) {
        Messages messages = plugin.messages();
        ShopInfo shop = context.shop();
        TagResolver tags = kit.shopTags(shop);
        Gui gui = new Gui(plugin.getServer(), 3, messages.plain("panel.titles.main", tags));

        gui.set(menu.slot("main.shop-name", 4), Icons.decorate(menu.icon("main.shop-name", Material.NAME_TAG), messages, "panel.shop.name",
                List.of("panel.shop.slug", "panel.shop.owner", "panel.shop.status", "panel.shop.zone"), tags));
        if (plugin.orderMode() == OrderMode.ROLEPLAY
                && (context.can(ShopPermission.ORDERS_DECIDE) || context.can(ShopPermission.ORDERS_PACKAGE))) {
            gui.set(menu.slot("main.orders-button", 10), Icons.decorate(menu.icon("main.orders-button", Material.CHEST), messages, "panel.orders.button", List.of("panel.orders.hint"), tags),
                    (p, click) -> showOrders(p, context));
        } else if (plugin.orderMode() == OrderMode.ROLEPLAY) {
            gui.set(menu.slot("main.orders-locked", 10), Icons.decorate(menu.icon("main.orders-locked", Material.GRAY_DYE), messages, "panel.orders.button", List.of("panel.no-permission-line"), tags));
        } else {
            gui.set(menu.slot("main.orders-automatic", 10), Icons.decorate(menu.icon("main.orders-automatic", Material.GRAY_DYE), messages, "panel.orders.automatic", List.of("panel.orders.automatic-hint"), tags));
        }
        gui.set(menu.slot("main.staff-button", 12), Icons.decorate(menu.icon("main.staff-button", Material.PLAYER_HEAD), messages, "panel.staff.button", List.of("panel.staff.hint"), tags),
                (p, click) -> staff.showStaff(p, context));
        gui.set(menu.slot("main.listings-button", 14), Icons.decorate(menu.icon("main.listings-button", Material.ITEM_FRAME), messages, "panel.listings.button", List.of("panel.listings.hint"), tags),
                (p, click) -> products.showListings(p, context));
        gui.set(menu.slot("main.storage-button", 16), Icons.decorate(menu.icon("main.storage-button", Material.BARREL), messages, "panel.storage.button", List.of("panel.storage.hint"), tags),
                (p, click) -> showStorage(p, context));
        settings.addButtons(gui, context);
        WebLinks.of(plugin.getConfig().getString("web.url", "")).ifPresent(links ->
                gui.set(menu.slot("main.web-button", 24), Icons.decorate(menu.icon("main.web-button", Material.FILLED_MAP), messages,
                                "panel.web.button", List.of("panel.web.hint"), tags),
                        (p, click) -> sendWebLinks(p, shop, links)));
        gui.set(menu.slot("main.close", 22), Icons.decorate(menu.icon("main.close", Material.BARRIER), messages, "panel.close", List.of()), (p, click) -> p.closeInventory());
        gui.fill(menu.filler()).open(player);
    }

    /**
     * A menu cannot open a browser: it closes and the chat gets clickable links to the shop's public
     * page (once approved) and to its seller panel on the web.
     */
    private void sendWebLinks(Player player, ShopInfo shop, WebLinks links) {
        Messages messages = plugin.messages();
        player.closeInventory();
        Component line = messages.get("panel.web.intro", Placeholder.unparsed("shop", shop.name()));
        if ("APPROVED".equals(shop.status())) {
            line = line.append(Component.space()).append(link(messages.plain("panel.web.storefront"), links.storefront(shop.slug())));
        }
        line = line.append(Component.space()).append(link(messages.plain("panel.web.panel"), links.panel(shop.slug())));
        player.sendMessage(line);
    }

    private static Component link(Component text, String url) {
        return text.clickEvent(ClickEvent.openUrl(url)).hoverEvent(HoverEvent.showText(Component.text(url)));
    }

    void showOrders(Player player, PanelContext context) {
        var roleplay = plugin.roleplay();
        if (roleplay == null) {
            return;
        }
        boolean terminal = !context.computer().kind().managesShop();
        kit.async(player, () -> roleplay.findShopOrders(context.computer().shopId(), PanelKit.LIST_SLOTS), all -> {
            // A delivery terminal only prints packages: it lists the accepted orders.
            List<ShopOrderView> list = terminal ? all.stream().filter(ShopOrderView::accepted).toList() : all;
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain(terminal ? "panel.titles.delivery" : "panel.titles.orders",
                    kit.shopTags(context.shop()), Placeholder.unparsed("count", String.valueOf(list.size()))));
            for (int slot = 0; slot < list.size(); slot++) {
                ShopOrderView order = list.get(slot);
                gui.set(slot, orders.orderIcon(order), (p, click) -> showOrderDecision(p, context, order));
            }
            kit.back(gui, context);
            gui.fill(menu.filler()).open(player);
        });
    }

    /**
     * One order with the customer's data: who (head, online or not, where they are), what, to which
     * locker and since when. Pending: ✔ accepts, ✖ rejects. Accepted: reprint the package.
     */
    private void showOrderDecision(Player player, PanelContext context, ShopOrderView order) {
        Messages messages = plugin.messages();
        var buyer = plugin.getServer().getPlayer(order.buyerId());
        var locker = order.lockerId() == null ? null : plugin.lockerController().registry().byId(order.lockerId()).orElse(null);
        Economy economy = plugin.economy();
        TagResolver tags = TagResolver.resolver(
                Placeholder.unparsed("buyer", order.buyerName()),
                Placeholder.component("presence", buyer == null ? messages.plain("panel.decision.offline")
                        : messages.plain("panel.decision.online",
                        Placeholder.unparsed("world", buyer.getWorld().getName()),
                        Placeholder.unparsed("x", String.valueOf(buyer.getLocation().getBlockX())),
                        Placeholder.unparsed("y", String.valueOf(buyer.getLocation().getBlockY())),
                        Placeholder.unparsed("z", String.valueOf(buyer.getLocation().getBlockZ())))),
                Placeholder.unparsed("title", order.title()),
                Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                Placeholder.unparsed("total", economy == null ? order.total().toPlainString()
                        : economy.format(order.total().doubleValue())),
                Placeholder.unparsed("locker", order.lockerName()),
                Placeholder.unparsed("locker_position", order.toMailbox()
                        ? (order.mailboxPosition() == null ? "?" : order.mailboxPosition())
                        : locker == null ? "?" : locker.position().world() + " "
                        + locker.position().x() + " " + locker.position().y() + " " + locker.position().z()),
                Placeholder.unparsed("age", RoleplayController.age(order.createdAt())),
                Placeholder.unparsed("order", order.id().toString().substring(0, 8)));

        Gui gui = new Gui(plugin.getServer(), 5, messages.plain("panel.titles.decision", tags));
        gui.set(menu.slot("orderDecision.buyer", 4), Icons.head(plugin.getServer().getOfflinePlayer(order.buyerId()), messages, "panel.decision.buyer",
                List.of("panel.decision.presence"), tags));
        Material material = Material.matchMaterial(order.material());
        gui.set(menu.slot("orderDecision.product", 20), Icons.decorate(new ItemStack(material != null && material.isItem() ? material : Material.PAPER), messages,
                "panel.decision.product", List.of("panel.decision.quantity", "panel.decision.total"), tags));
        gui.set(menu.slot("orderDecision.destination", 22), order.toMailbox()
                ? Icons.decorate(menu.icon("orderDecision.mailbox", plugin.mailboxController().blockMaterial()), messages,
                        "panel.decision.mailbox", List.of("panel.decision.locker-position", "panel.decision.mailbox-hint"), tags)
                : Icons.decorate(menu.icon("orderDecision.locker", Material.ENDER_CHEST), messages, "panel.decision.locker",
                        List.of("panel.decision.locker-position"), tags));
        gui.set(menu.slot("orderDecision.decision-when", 24), Icons.decorate(menu.icon("orderDecision.decision-when", Material.CLOCK), messages, "panel.decision.when", List.of("panel.decision.order-id"), tags));
        if (order.awaitingDecision() && context.computer().kind().managesShop() && context.can(ShopPermission.ORDERS_DECIDE)) {
            gui.set(menu.slot("orderDecision.decision-accept", 38), Icons.decorate(menu.icon("orderDecision.decision-accept", Material.LIME_CONCRETE), messages, "panel.decision.accept", List.of("panel.decision.accept-hint"), tags),
                    (p, click) -> orders.accept(p, context.computer(), order));
            gui.set(menu.slot("orderDecision.decision-reject", 42), Icons.decorate(menu.icon("orderDecision.decision-reject", Material.RED_CONCRETE), messages, "panel.decision.reject", List.of("panel.decision.reject-hint"), tags),
                    (p, click) -> orders.reject(p, context.computer(), order, () -> showOrders(p, context)));
        } else if (order.accepted() && ExpressRule.needsCourier(order.toMailbox(), plugin.mailboxController().handDelivery()) && context.can(ShopPermission.ORDERS_PACKAGE)) {
            gui.set(menu.slot("orderDecision.decision-reprint", 40), Icons.decorate(menu.icon("orderDecision.decision-reprint", Material.PAPER), messages, "panel.decision.reprint", List.of("panel.decision.reprint-hint"), tags),
                    (p, click) -> orders.reprintPackage(p, order));
        }
        gui.set(menu.slot("orderDecision.back", 36), Icons.decorate(menu.icon("orderDecision.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showOrders(p, context));
        gui.fill(menu.filler()).open(player);
    }

    private void showStorage(Player player, PanelContext context) {
        Messages messages = plugin.messages();
        TagResolver tags = kit.shopTags(context.shop());
        Gui gui = new Gui(plugin.getServer(), 4, messages.plain("panel.titles.storage", tags));
        gui.set(menu.slot("storage.storage-info", 4), Icons.decorate(menu.icon("storage.storage-info", Material.BARREL), messages, "panel.storage.info",
                List.of("panel.storage.used", "panel.storage.blocks", "panel.shop.zone"), tags));
        // Storage types on sale: left click buys one, right click buys eight.
        int slot = 9;
        for (StorageType type : plugin.storageController().types()) {
            if (!type.buyable() || slot > 26 || !context.can(ShopPermission.STORAGE_BUY)) {
                continue;
            }
            gui.set(slot++, Icons.of(type.material(), messages, "panel.storage.type",
                            List.of("panel.storage.type-capacity", "panel.storage.type-price", "panel.storage.type-hint"),
                            plugin.storageController().typeTags(type)),
                    (p, click) -> {
                        if (PanelKit.isRight(click)) {
                            plugin.chatPrompt().askAmount(p, "prompt.buy", kit.maxPurchase(),
                                    amount -> plugin.storageController().buy(p, type.id(), amount));
                        } else {
                            plugin.storageController().buy(p, type.id(), 1);
                        }
                    });
        }
        if (context.can(ShopPermission.STORAGE_BUY)) gui.set(menu.slot("storage.storage-buy-computer", 31), Icons.decorate(menu.icon("storage.storage-buy-computer", Material.CRAFTER), messages, "panel.storage.buy-computer", List.of("panel.storage.buy-hint")),
                (p, click) -> {
                    if (PanelKit.isRight(click)) {
                        plugin.chatPrompt().askAmount(p, "prompt.buy", kit.maxPurchase(),
                                amount -> plugin.roleplayController().buy(p, amount));
                    } else {
                        plugin.roleplayController().buy(p, 1);
                    }
                });
        if (context.can(ShopPermission.STORAGE_BUY) && plugin.orderMode() == OrderMode.ROLEPLAY) {
            var shop = new RoleplayItems.TerminalShop(context.shop().id(), context.shop().name());
            gui.set(menu.slot("storage.storage-buy-terminal", 32), Icons.decorate(menu.icon("storage.storage-buy-terminal",
                            plugin.roleplayController().items().terminalBlock()), messages, "panel.storage.buy-terminal",
                            List.of("panel.storage.buy-terminal-hint", "panel.storage.buy-hint")),
                    (p, click) -> {
                        if (PanelKit.isRight(click)) {
                            plugin.chatPrompt().askAmount(p, "prompt.buy", kit.maxPurchase(),
                                    amount -> plugin.roleplayController().buyTerminal(p, shop, amount));
                        } else {
                            plugin.roleplayController().buyTerminal(p, shop, 1);
                        }
                    });
        }
        gui.set(menu.slot("storage.back", 27), Icons.decorate(menu.icon("storage.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> open(p, context.computer()));
        gui.fill(menu.filler()).open(player);
    }
}
