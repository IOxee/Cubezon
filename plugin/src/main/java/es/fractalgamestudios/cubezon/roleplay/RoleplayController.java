package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.OrderRepository;
import es.fractalgamestudios.cubezon.database.OrderRepository.ClaimResult;
import es.fractalgamestudios.cubezon.database.RoleplayRepository;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.locker.Locker;
import es.fractalgamestudios.cubezon.mailbox.Mailbox;
import es.fractalgamestudios.cubezon.order.ClaimedOrder;
import es.fractalgamestudios.cubezon.order.FailureReason;
import es.fractalgamestudios.cubezon.order.OrderDelay;
import es.fractalgamestudios.cubezon.order.OrderMode;
import es.fractalgamestudios.cubezon.order.OrderPayment;
import es.fractalgamestudios.cubezon.order.OrderProcessor;
import es.fractalgamestudios.cubezon.order.VaultWallet;
import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.storage.SpecialItemShop;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;

import java.sql.SQLException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Roleplay order mode. Each shop handles its own orders from a company computer placed in its
 * zone: accepting charges the buyer (the money is held) and prints a package; whoever carries the
 * package to the order's locker delivers it (READY) and the seller is paid then. Orders nobody
 * handles expire (config). The same safety rules as automatic mode apply: claim before charging,
 * mark before paying out, never pay twice.
 *
 * <p>Placement ({@link ComputerPlacement}), deliveries ({@link PackageDelivery}), payouts
 * ({@link RoleplayPayouts}) and employees ({@link ShopMembers}) live in their own classes; this one
 * wires them and keeps accepting and rejecting orders.
 */
public final class RoleplayController {

    private final CubezonPlugin plugin;
    private final ComputerRegistry registry = new ComputerRegistry();
    private final RoleplayItems items;
    private final SpecialItemShop itemShop;
    /** Orders with an accept, reject or delivery in flight: double clicks cannot race. */
    private final Set<UUID> busyOrders = ConcurrentHashMap.newKeySet();
    private final RoleplayKit kit;
    private final ComputerPlacement placement;
    private final RoleplayPayouts payouts;
    private final PackageDelivery delivery;
    private final ShopMembers members;
    private final ComputerPanel panel;

    public RoleplayController(CubezonPlugin plugin) {
        this.plugin = plugin;
        this.items = new RoleplayItems(plugin);
        this.itemShop = new SpecialItemShop(plugin, "computer", "computer", "company_computer",
                amount -> items.computer(amount, plugin.messages()));
        this.kit = new RoleplayKit(plugin);
        this.placement = new ComputerPlacement(plugin, kit, registry, items);
        this.payouts = new RoleplayPayouts(plugin, kit);
        // One busyOrders set for accept, reject and delivery: a package cannot be delivered mid-accept.
        this.delivery = new PackageDelivery(plugin, kit, items, payouts, busyOrders, this::courierMaxPercent);
        this.members = new ShopMembers(plugin);
        this.panel = new ComputerPanel(plugin, this);
    }

    public RoleplayItems items() {
        return items;
    }

    public ComputerRegistry registry() {
        return registry;
    }

    public SpecialItemShop itemShop() {
        return itemShop;
    }

    private boolean roleplay() {
        return plugin.orderMode() == OrderMode.ROLEPLAY;
    }

    /** Publishes the order mode for the web (it tells buyers whether shops accept orders by hand). */
    public void publishMode() {
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            return;
        }
        int courierMaxPercent = courierMaxPercent();
        plugin.dbExecutor().execute(() -> {
            try {
                roleplay.publishSetting("orders_mode", plugin.orderMode().key());
                // Roleplay has no artificial wait: the shop accepts and delivers when its staff does.
                OrderDelay delay = roleplay() ? OrderDelay.NONE : OrderDelay.fromConfig(plugin.getConfig());
                roleplay.publishSetting("auto_delay_min_seconds", String.valueOf(delay.minSeconds()));
                roleplay.publishSetting("auto_delay_max_seconds", String.valueOf(delay.maxSeconds()));
                roleplay.publishSetting("courier_max_percent", String.valueOf(courierMaxPercent));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not publish the order mode", e);
            }
        });
    }

    public void refresh() {
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            registry.replaceAll(List.of());
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                registry.replaceAll(roleplay.findComputers());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not refresh company computers", e);
            }
        });
    }

    /**
     * Every minute (main thread): pays out held money whose payout failed before and, in roleplay
     * mode, expires orders nobody handled.
     */
    public void runJobs() {
        OrderRepository orders = plugin.orders();
        Economy economy = plugin.economy();
        if (orders == null) {
            return;
        }
        int acceptHours = Math.max(1, plugin.getConfig().getInt("orders.roleplay.accept-hours", 48));
        int deliverHours = Math.max(1, plugin.getConfig().getInt("orders.roleplay.deliver-hours", 48));
        boolean roleplay = roleplay();
        plugin.dbExecutor().execute(() -> {
            try {
                if (roleplay) {
                    for (ClaimedOrder order : orders.expirePending(acceptHours)) {
                        kit.notifyBuyerFailed(order, FailureReason.EXPIRED);
                    }
                }
                if (economy == null) {
                    return; // Refunds and payouts need the economy; they wait until it is back.
                }
                // Each claim commits on its own: its money is handed to the main thread before the next claim
                // runs, so a later failure never strands what an earlier one already marked.
                if (roleplay) {
                    payouts.payOnMainThread(economy, orders.expireAccepted(deliverHours), payouts::refundExpired);
                }
                payouts.payOnMainThread(economy, orders.claimPendingPayouts(), payouts::payOut);
                payouts.payOnMainThread(economy, orders.claimPendingCourierPayouts(), payouts::payCourier);
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not run the order jobs", e);
            }
        });
    }

    /** See {@link ComputerPlacement#handlePlace}. */
    public void handlePlace(BlockPlaceEvent event) {
        placement.handlePlace(event);
    }

    /** A computer still being registered: it cannot be broken or pushed until the database answers. */
    public boolean isPending(BlockPosition position) {
        return placement.isPending(position);
    }

    public void handleBreak(BlockBreakEvent event, ComputerBlock computer) {
        placement.handleBreak(event, computer);
    }

    /** Right click on a computer: the shop's control panel, for the owner and employees. */
    public void openComputer(Player player, ComputerBlock computer) {
        panel.open(player, computer);
    }

    /** Panel: an accepted order's package, printed again (copies are harmless). */
    void reprintPackage(Player player, ShopOrderView order) {
        SpecialItemShop.giveOrDrop(player, packageOf(order));
        // An express package goes to the buyer's mailbox: say whose and where, there is no locker name.
        player.sendMessage(order.toMailbox()
                ? plugin.messages().get("computer.package-reprinted-mailbox",
                        Placeholder.unparsed("owner", order.buyerName()),
                        Placeholder.unparsed("position", order.mailboxPosition() == null ? "?" : order.mailboxPosition()))
                : plugin.messages().get("computer.package-reprinted",
                        Placeholder.unparsed("locker", order.lockerName())));
    }

    void accept(Player player, ComputerBlock computer, ShopOrderView view) {
        if (!computer.kind().managesShop()) {
            return; // Delivery terminals only print packages.
        }
        Messages messages = plugin.messages();
        OrderRepository orders = plugin.orders();
        Economy economy = plugin.economy();
        if (orders == null || economy == null) {
            player.sendMessage(messages.get(orders == null ? "error.database-required" : "error.economy-missing"));
            return;
        }
        if (!busyOrders.add(view.id())) {
            return;
        }
        player.closeInventory();
        UUID deciderId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        plugin.dbExecutor().execute(() -> {
            ClaimResult result;
            try {
                if (!admin && !mayDecide(computer.shopId(), deciderId)) {
                    busyOrders.remove(view.id());
                    player.sendMessage(messages.get("panel.no-permission"));
                    plugin.sounds().play(player, Sounds.Event.ERROR);
                    return;
                }
                result = orders.claimById(view.id(), computer.shopId(), OrderProcessor::isValidItem, OrderProcessor.maxTip(plugin.getConfig()));
            } catch (SQLException | RuntimeException e) {
                busyOrders.remove(view.id());
                plugin.getLogger().log(Level.WARNING, "Could not accept order " + view.id(), e);
                player.sendMessage(messages.get("computer.failed"));
                return;
            }
            switch (result) {
                case ClaimResult.None none -> {
                    busyOrders.remove(view.id());
                    player.sendMessage(messages.get("computer.order-gone"));
                }
                case ClaimResult.Failed failed -> {
                    busyOrders.remove(view.id());
                    player.sendMessage(messages.get("computer.accept-failed",
                            Placeholder.component("reason", messages.plain("order.reason." + failed.reason().name()))));
                    kit.notifyBuyerFailed(failed.order(), failed.reason());
                }
                case ClaimResult.Claimed claimed -> chargeAndAccept(player, claimed.order(), view, economy, orders);
            }
        });
    }

    private void chargeAndAccept(Player player, ClaimedOrder order, ShopOrderView view, Economy economy,
                                 OrderRepository orders) {
        Messages messages = plugin.messages();
        kit.runOnMainThread(() -> {
            Optional<FailureReason> failure;
            try {
                failure = OrderPayment.chargeBuyer(new VaultWallet(economy, plugin.getServer()), order);
            } catch (RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Economy error while charging order " + order.id(), e);
                failure = Optional.of(FailureReason.PAYMENT_ERROR);
            }
            Optional<FailureReason> outcome = failure;
            plugin.dbExecutor().execute(() -> {
                try {
                    if (outcome.isPresent()) {
                        orders.fail(order.id(), outcome.get());
                        player.sendMessage(messages.get("computer.accept-failed",
                                Placeholder.component("reason", messages.plain("order.reason." + outcome.get().name()))));
                        kit.notifyBuyerFailed(order, outcome.get());
                        return;
                    }
                    if (order.toMailbox() && !ExpressRule.needsCourier(true, plugin.mailboxController().handDelivery())) {
                        acceptIntoMailbox(player, order, orders, economy);
                        return;
                    }
                    if (!orders.markAccepted(order.id())) {
                        plugin.getLogger().severe("Order " + order.id() + " was charged but is no longer claimed; check it by hand"
                                + " (buyer " + order.buyerId() + ", " + order.charged() + ").");
                        return;
                    }
                    kit.runOnMainThread(() -> {
                        if (player.isOnline()) {
                            // The package is not printed on its own: staff print it from the order screen.
                            plugin.sounds().play(player, Sounds.Event.SUCCESS);
                            player.sendMessage(messages.get(order.toMailbox() ? "computer.accepted-hand" : "computer.accepted",
                                    Placeholder.unparsed("title", order.title()),
                                    Placeholder.unparsed("locker", order.lockerName())));
                        }
                        kit.notifyOnline(order.buyerId(), messages.get("order.accepted",
                                Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                                Placeholder.unparsed("title", order.title()),
                                Placeholder.unparsed("shop", order.shopName())));
                    });
                } catch (SQLException | RuntimeException e) {
                    plugin.getLogger().log(Level.SEVERE, "Order " + order.id() + " may have been charged but could not be"
                            + " updated; it will be recovered as INTERRUPTED on the next start", e);
                    player.sendMessage(messages.get("computer.failed"));
                } finally {
                    busyOrders.remove(order.id());
                }
            });
        });
    }

    void reject(Player player, ComputerBlock computer, ShopOrderView view, Runnable then) {
        if (!computer.kind().managesShop()) {
            return; // Delivery terminals only print packages.
        }
        Messages messages = plugin.messages();
        OrderRepository orders = plugin.orders();
        if (orders == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        if (!busyOrders.add(view.id())) {
            return;
        }
        UUID deciderId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        plugin.dbExecutor().execute(() -> {
            try {
                if (!admin && !mayDecide(computer.shopId(), deciderId)) {
                    player.sendMessage(messages.get("panel.no-permission"));
                    plugin.sounds().play(player, Sounds.Event.ERROR);
                    return;
                }
                if (orders.reject(view.id(), computer.shopId())) {
                    player.sendMessage(messages.get("computer.rejected", Placeholder.unparsed("title", view.title())));
                    kit.notifyBuyerRejected(view);
                } else {
                    player.sendMessage(messages.get("computer.order-gone"));
                }
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not reject order " + view.id(), e);
                player.sendMessage(messages.get("computer.failed"));
            } finally {
                busyOrders.remove(view.id());
            }
            kit.runOnMainThread(() -> {
                if (player.isOnline()) {
                    then.run();
                }
            });
        });
    }

    /**
     * Database thread. Express order: no package and no courier, it goes straight to the buyer's
     * mailbox (READY) and the seller is paid now.
     */
    private void acceptIntoMailbox(Player player, ClaimedOrder order, OrderRepository orders, Economy economy)
            throws SQLException {
        Messages messages = plugin.messages();
        if (!orders.acceptIntoMailbox(order.id())) {
            plugin.getLogger().severe("Express order " + order.id() + " was charged but is no longer claimed; check it by hand"
                    + " (buyer " + order.buyerId() + ", " + order.charged() + ").");
            return;
        }
        kit.runOnMainThread(() -> {
            payouts.payOut(new VaultWallet(economy, plugin.getServer()), order);
            if (player.isOnline()) {
                player.sendMessage(messages.get("computer.accepted-mailbox", Placeholder.unparsed("title", order.title())));
                plugin.sounds().play(player, Sounds.Event.SUCCESS);
                plugin.sounds().play(plugin.getServer().getPlayer(order.buyerId()), Sounds.Event.ORDER_READY);
            }
            kit.notifyOnline(order.buyerId(), messages.get("order.ready-mailbox",
                    Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                    Placeholder.unparsed("title", order.title())));
        });
    }

    /** Database thread. Accepting and rejecting need orders.decide in that shop. */
    private boolean mayDecide(UUID shopId, UUID playerId) throws SQLException {
        RoleplayRepository roleplay = plugin.roleplay();
        return roleplay != null && roleplay.can(shopId, playerId, ShopPermission.ORDERS_DECIDE.key());
    }

    /** Main thread. Right click on a locker holding a package. */
    public void deliver(Player player, Locker locker, RoleplayItems.PackageLabel label) {
        delivery.deliver(player, locker, label);
    }

    /** Main thread. Right click on the buyer's mailbox with a hand-delivered express package. */
    public void deliverToMailbox(Player player, Mailbox mailbox, RoleplayItems.PackageLabel label) {
        delivery.deliverToMailbox(player, mailbox, label);
    }

    /** Server cap on the courier's share of the goods, 0-100 (orders.roleplay.courier-max-percent). */
    public int courierMaxPercent() {
        return Math.clamp(plugin.getConfig().getInt("orders.roleplay.courier-max-percent", 50), 0, 100);
    }

    public void addMember(Player owner, String slug, String playerName) {
        members.addMember(owner, slug, playerName);
    }

    public void removeMember(Player owner, String slug, String playerName) {
        members.removeMember(owner, slug, playerName);
    }

    public void listMembers(Player requester, String slug) {
        members.listMembers(requester, slug);
    }

    /** Icon of an order on the computer's orders screen. */
    ItemStack orderIcon(ShopOrderView order) {
        Messages messages = plugin.messages();
        Material material = Material.matchMaterial(order.material());
        ItemStack icon = new ItemStack(material != null && material.isItem() ? material : Material.PAPER);
        Economy economy = plugin.economy();
        String total = economy == null ? order.total().toPlainString() : economy.format(order.total().doubleValue());
        String state = order.awaitingDecision() ? "computer.lore-state-pending"
                : order.accepted() ? "computer.lore-state-accepted" : "computer.lore-state-processing";
        String actions = order.awaitingDecision() ? "computer.lore-actions-pending"
                : order.accepted() ? "computer.lore-actions-accepted" : null;
        icon.editMeta(meta -> {
            meta.displayName(Component.text(order.quantity() + "x " + order.title()).decoration(TextDecoration.ITALIC, false));
            meta.addItemFlags(ItemFlag.values());
            var lore = new ArrayList<Component>(List.of(
                    lore(messages, state),
                    lore(messages, "computer.lore-buyer", Placeholder.unparsed("buyer", order.buyerName())),
                    lore(messages, "computer.lore-total", Placeholder.unparsed("total", total)),
                    lore(messages, "computer.lore-locker", Placeholder.unparsed("locker", order.lockerName())),
                    lore(messages, "computer.lore-age", Placeholder.unparsed("age", age(order.createdAt())))));
            if (actions != null) {
                lore.add(lore(messages, actions));
            }
            meta.lore(lore);
        });
        return icon;
    }

    private ItemStack packageOf(ShopOrderView view) {
        // Express orders carried by hand go to the buyer's mailbox; everything else to the order's locker.
        RoleplayItems.PackageLabel label = view.toMailbox()
                ? new RoleplayItems.PackageLabel(view.id(), view.mailboxId(), view.buyerName(), view.title(), true)
                : new RoleplayItems.PackageLabel(view.id(), view.lockerId(), view.lockerName(), view.title(), false);
        return items.packageFor(label, view.quantity(), plugin.messages());
    }

    private static Component lore(Messages messages, String key, TagResolver... resolvers) {
        return messages.plain(key, resolvers).decoration(TextDecoration.ITALIC, false);
    }

    /** "5 min", "3 h", "2 d". */
    static String age(OffsetDateTime since) {
        long minutes = Math.max(0, Duration.between(since, OffsetDateTime.now()).toMinutes());
        if (minutes < 60) {
            return minutes + " min";
        }
        return minutes < 60 * 24 ? (minutes / 60) + " h" : (minutes / (60 * 24)) + " d";
    }

    /** For commands: buy or give computers. */
    public void buy(Player player, int amount) {
        itemShop.buy(player, amount);
    }

    public void give(CommandSender sender, Player target, int amount) {
        itemShop.give(sender, target, amount);
    }

    /** Main thread. Delivery terminals of one shop, bought from its full computer (computer.delivery.buy). */
    public void buyTerminal(Player player, RoleplayItems.TerminalShop shop, int amount) {
        new SpecialItemShop(plugin, "computer.delivery", "computer.delivery", "delivery_terminal",
                count -> items.deliveryTerminal(count, shop, plugin.messages())).buy(player, amount);
    }
}
