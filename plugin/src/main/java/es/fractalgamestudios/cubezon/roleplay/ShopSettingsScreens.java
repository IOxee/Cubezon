package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.ShopInfo;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.ChatPrompt;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.mailbox.ExpressPricing;
import es.fractalgamestudios.cubezon.order.CourierCommission;
import es.fractalgamestudios.cubezon.order.OrderMode;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** The shop's own settings on the company computer: the courier commission and the express fee. */
final class ShopSettingsScreens {

    private final CubezonPlugin plugin;
    private final RoleplayController orders;
    private final PanelKit kit;
    /** Slots and icons of the buttons (menus.yml). */
    private final MenuLayout menu;

    ShopSettingsScreens(CubezonPlugin plugin, RoleplayController orders, PanelKit kit, MenuLayout menu) {
        this.plugin = plugin;
        this.orders = orders;
        this.kit = kit;
        this.menu = menu;
    }

    /** The main screen's buttons: courier commission (roleplay mode) and express fee (if shops set it). */
    void addButtons(Gui gui, PanelContext context) {
        Messages messages = plugin.messages();
        ShopInfo shop = context.shop();
        if (plugin.orderMode() == OrderMode.ROLEPLAY) {
            TagResolver commissionTags = commissionTags(shop.commission());
            gui.set(menu.slot("main.commission-button", 18), Icons.decorate(menu.icon("main.commission-button", Material.GOLD_INGOT), messages,
                            "panel.commission.button", List.of("panel.commission.current", "panel.commission.hint",
                                    context.owner() ? "panel.commission.choose" : "panel.commission.owner-only"), commissionTags),
                    (p, click) -> {
                        if (context.owner()) {
                            showCommission(p, context);
                        }
                    });
        }
        var mailboxes = plugin.mailboxController();
        if (mailboxes.expressEnabled() && mailboxes.expressPricing().shopsSetFee()) {
            gui.set(menu.slot("main.express-fee-button", 20), Icons.decorate(menu.icon("main.express-fee-button", Material.FEATHER), messages,
                            "panel.express-fee.button", List.of("panel.express-fee.current", "panel.express-fee.hint",
                                    context.owner() ? "panel.express-fee.click" : "panel.express-fee.owner-only"), expressFeeTags(shop)),
                    (p, click) -> {
                        if (context.owner()) {
                            chooseExpressFee(p, context, click == ClickType.RIGHT || click == ClickType.SHIFT_RIGHT);
                        }
                    });
        }
    }

    /** Owner only. Left click asks the fee in chat; right click goes back to the server's fee. */
    private void chooseExpressFee(Player player, PanelContext context, boolean reset) {
        if (reset) {
            saveExpressFee(player, context, null);
            return;
        }
        plugin.chatPrompt().askPrice(player, "prompt.express-fee", fee -> {
            var mailboxes = plugin.mailboxController();
            if (!mailboxes.expressPricing().accepts(fee, mailboxes.expressMaxFee())) {
                player.sendMessage(plugin.messages().get("panel.express-fee.too-high", expressFeeTags(context.shop())));
                return;
            }
            saveExpressFee(player, context, fee);
        });
    }

    private void saveExpressFee(Player player, PanelContext context, @Nullable BigDecimal fee) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> panel.setExpressFee(context.shop().id(), playerId, admin, fee), saved -> {
            Messages messages = plugin.messages();
            if (!saved) {
                player.sendMessage(messages.get("panel.express-fee.failed"));
                return;
            }
            player.sendMessage(fee == null ? messages.get("panel.express-fee.reset")
                    : messages.get("panel.express-fee.saved", Placeholder.unparsed("fee", kit.money(fee))));
            kit.open(player, context.computer());
        });
    }

    /** &lt;fee&gt; (what the shop charges now), &lt;server&gt; (the server's fee) and &lt;max&gt; (the cap, if any). */
    private TagResolver expressFeeTags(ShopInfo shop) {
        var mailboxes = plugin.mailboxController();
        BigDecimal fee = mailboxes.expressPricing().feeFor(mailboxes.expressFee(), mailboxes.expressMaxFee(), shop.expressFee());
        return TagResolver.resolver(
                Placeholder.unparsed("fee", kit.money(fee)),
                Placeholder.unparsed("server", kit.money(mailboxes.expressFee())),
                Placeholder.component("max", plugin.messages().plain(mailboxes.expressPricing() == ExpressPricing.SHOP_CAPPED
                        ? "panel.express-fee.max" : "panel.express-fee.no-max", Placeholder.unparsed("max", kit.money(mailboxes.expressMaxFee())))),
                Placeholder.component("origin", plugin.messages().plain(shop.expressFee() == null
                        ? "panel.express-fee.from-server" : "panel.express-fee.from-shop")));
    }

    /** Owner only: what the employee who delivers a package earns, out of the sale. */
    private void showCommission(Player player, PanelContext context) {
        Messages messages = plugin.messages();
        CourierCommission current = context.shop().commission();
        Gui gui = new Gui(plugin.getServer(), 3, messages.plain("panel.commission.title", kit.shopTags(context.shop())));
        TagResolver tags = commissionTags(current);
        for (CourierCommission.Mode mode : CourierCommission.Mode.values()) {
            String entry = "commission." + mode.name();
            gui.set(menu.slot(entry, 10 + 2 * mode.ordinal()), Icons.decorate(menu.icon(entry, Material.PAPER), messages,
                            "panel.commission." + mode.name(), List.of(mode == current.mode() ? "panel.commission.selected"
                                    : "panel.commission.choose", "panel.commission.hint"), tags),
                    (p, click) -> chooseCommission(p, context, mode));
        }
        gui.set(menu.slot("commission.back", 22), Icons.decorate(menu.icon("commission.back", Material.ARROW), messages, "panel.back", List.of()),
                (p, click) -> kit.showMain(p, context));
        gui.fill(menu.filler()).open(player);
    }

    /** No commission is saved at once; a percentage or an amount is asked in chat first. */
    private void chooseCommission(Player player, PanelContext context, CourierCommission.Mode mode) {
        ChatPrompt prompt = plugin.chatPrompt();
        switch (mode) {
            case NONE -> saveCommission(player, context, CourierCommission.NONE);
            case PERCENT_TOTAL, PERCENT_EXPRESS -> prompt.askAmount(player, "prompt.commission-percent", 100,
                    percent -> saveCommission(player, context, new CourierCommission(mode, BigDecimal.valueOf(percent))));
            case FIXED -> prompt.askPrice(player, "prompt.commission-fixed",
                    amount -> saveCommission(player, context, new CourierCommission(mode, amount)));
        }
    }

    private void saveCommission(Player player, PanelContext context, CourierCommission commission) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> panel.setCourierCommission(context.shop().id(), playerId, admin, commission), saved -> {
            Messages messages = plugin.messages();
            if (!saved) {
                player.sendMessage(messages.get("panel.commission.failed"));
                return;
            }
            player.sendMessage(messages.get("panel.commission.saved", commissionTags(commission)));
            plugin.getLogger().info("Courier commission of " + context.shop().slug() + " set to " + commission.mode() + " "
                    + commission.value() + " by " + player.getName());
            kit.open(player, context.computer());
        });
    }

    /** &lt;commission&gt; (the current choice in words) and &lt;max&gt; (the server cap). */
    private TagResolver commissionTags(CourierCommission commission) {
        Messages messages = plugin.messages();
        String value = commission.mode().percent() ? commission.value().stripTrailingZeros().toPlainString()
                : plugin.economy() == null ? commission.value().toPlainString() : plugin.economy().format(commission.value().doubleValue());
        return TagResolver.resolver(
                Placeholder.component("commission", messages.plain("panel.commission.describe." + commission.mode().name(),
                        Placeholder.unparsed("value", value))),
                Placeholder.unparsed("max", String.valueOf(orders.courierMaxPercent())));
    }
}
