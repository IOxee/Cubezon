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
import es.fractalgamestudios.cubezon.storage.ShopZone;
import es.fractalgamestudios.cubezon.storage.SpecialItemShop;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.Container;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.logging.Level;

/**
 * Roleplay order mode. Each shop handles its own orders from a company computer placed in its
 * zone: accepting charges the buyer (the money is held) and prints a package; whoever carries the
 * package to the order's locker delivers it (READY) and the seller is paid then. Orders nobody
 * handles expire (config). The same safety rules as automatic mode apply: claim before charging,
 * mark before paying out, never pay twice.
 */
public final class RoleplayController {

    private final CubezonPlugin plugin;
    private final ComputerRegistry registry = new ComputerRegistry();
    private final RoleplayItems items;
    private final SpecialItemShop itemShop;
    /** Computers placed but not yet registered in the database (see handlePlace). */
    private final Set<BlockPosition> pendingPlacements = ConcurrentHashMap.newKeySet();
    /** Orders with an accept, reject or delivery in flight: double clicks cannot race. */
    private final Set<UUID> busyOrders = ConcurrentHashMap.newKeySet();
    /** Computers whose removal is in flight, so a double break cannot drop two items. */
    private final Set<UUID> breaking = ConcurrentHashMap.newKeySet();
    private final ComputerPanel panel;

    public RoleplayController(CubezonPlugin plugin) {
        this.plugin = plugin;
        this.items = new RoleplayItems(plugin);
        this.itemShop = new SpecialItemShop(plugin, "computer", "computer", "company_computer",
                amount -> items.computer(amount, plugin.messages()));
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
                        notifyBuyerFailed(order, FailureReason.EXPIRED);
                    }
                }
                if (economy == null) {
                    return; // Refunds and payouts need the economy; they wait until it is back.
                }
                // Each claim commits on its own: its money is handed to the main thread before the next claim
                // runs, so a later failure never strands what an earlier one already marked.
                if (roleplay) {
                    payOnMainThread(economy, orders.expireAccepted(deliverHours), this::refundExpired);
                }
                payOnMainThread(economy, orders.claimPendingPayouts(), this::payOut);
                payOnMainThread(economy, orders.claimPendingCourierPayouts(), this::payCourier);
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not run the order jobs", e);
            }
        });
    }

    /** Database thread. Pays each claimed order on the main thread. */
    private void payOnMainThread(Economy economy, List<ClaimedOrder> claimed,
                                 BiConsumer<OrderPayment.Wallet, ClaimedOrder> pay) {
        if (claimed.isEmpty()) {
            return;
        }
        runOnMainThread(() -> {
            var wallet = new VaultWallet(economy, plugin.getServer());
            for (ClaimedOrder order : claimed) {
                pay.accept(wallet, order);
            }
        });
    }

    /** Main thread. The order is already REFUNDED in the database; the buyer gets the money back. */
    private void refundExpired(OrderPayment.Wallet wallet, ClaimedOrder order) {
        if (!OrderPayment.pay(wallet, order.buyerId(), order.charged(), order.selfPurchase())) {
            plugin.getLogger().severe("Order " + order.id() + " expired undelivered (REFUNDED) but the refund of "
                    + order.charged() + " to buyer " + order.buyerId() + " failed. Give it back by hand.");
        }
        notifyBuyerFailed(order, FailureReason.DELIVERY_EXPIRED);
    }

    /**
     * A full computer goes inside its shop's zone and only the owner places it. A delivery terminal
     * goes anywhere except another shop's zone; its shop's owner or anyone there with orders.package
     * places it (checked in the database, so the block is taken back if they may not).
     */
    public void handlePlace(BlockPlaceEvent event) {
        ItemStack hand = event.getItemInHand();
        if (!items.isComputer(hand)) {
            return;
        }
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        BlockPosition position = BlockPosition.of(event.getBlockPlaced());
        ShopZone zone = plugin.storageController().registry().zoneAt(position).orElse(null);
        RoleplayItems.TerminalShop terminal = items.terminalShop(hand).orElse(null);
        ComputerKind kind = terminal == null ? ComputerKind.FULL : ComputerKind.DELIVERY;
        ComputerKind.Placement placement = kind.placement(zone == null ? null : zone.shopId(),
                terminal == null ? null : terminal.shopId());
        if (placement != ComputerKind.Placement.OK) {
            event.setCancelled(true);
            player.sendMessage(placement == ComputerKind.Placement.OTHER_SHOP_ZONE && zone != null
                    ? messages.get("computer.delivery.other-zone", Placeholder.unparsed("shop", zone.shopName()))
                    : messages.get("computer.outside-zone"));
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        if (kind == ComputerKind.FULL && !zone.ownerId().equals(playerId) && !admin) {
            event.setCancelled(true);
            player.sendMessage(messages.get("storage.not-yours", Placeholder.unparsed("shop", zone.shopName())));
            return;
        }
        UUID shopId = terminal == null ? zone.shopId() : terminal.shopId();
        String shopName = terminal == null ? zone.shopName() : terminal.shopName();
        TagResolver shopTag = Placeholder.unparsed("shop", shopName);
        Placed placed = new Placed(player, position, event.getBlockPlaced().getType(), hand.asOne());
        pendingPlacements.add(position);
        plugin.dbExecutor().execute(() -> {
            try {
                if (kind == ComputerKind.DELIVERY && !admin
                        && !roleplay.can(shopId, playerId, ShopPermission.ORDERS_PACKAGE.key())) {
                    undoPlacement(placed, messages.get("computer.delivery.not-staff", shopTag));
                    return;
                }
                registry.put(roleplay.insertComputer(shopId, shopName, position, playerId, kind));
                pendingPlacements.remove(position);
                player.sendMessage(messages.get(kind == ComputerKind.FULL ? "computer.placed" : "computer.delivery.placed", shopTag));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not register the computer at " + position, e);
                undoPlacement(placed, messages.get("computer.place-failed"));
            }
        });
    }

    /** A computer still being registered: it cannot be broken or pushed until the database answers. */
    public boolean isPending(BlockPosition position) {
        return pendingPlacements.contains(position);
    }

    /** A computer block just placed, and the item to give back if it cannot stay. */
    private record Placed(Player player, BlockPosition position, Material type, ItemStack item) {
    }

    /**
     * Database thread. Takes the block back and returns the item (dropped there if the player left).
     * The item only comes back if the block was really taken back: never a block and an item.
     */
    private void undoPlacement(Placed placed, Component message) {
        runOnMainThread(() -> {
            pendingPlacements.remove(placed.position());
            Block block = blockAt(placed.position());
            if (block == null || block.getType() != placed.type()) {
                plugin.getLogger().warning("Computer at " + placed.position() + " was not registered and its block is gone;"
                        + " nothing returned to " + placed.player().getName() + ".");
                return;
            }
            block.setType(Material.AIR);
            if (placed.player().isOnline()) {
                SpecialItemShop.giveOrDrop(placed.player(), placed.item());
                placed.player().sendMessage(message);
            } else {
                block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5), placed.item());
            }
        });
    }

    /** The item a placed computer turns back into when broken. */
    private ItemStack itemOf(ComputerBlock computer) {
        return computer.kind() == ComputerKind.FULL
                ? items.computer(1, plugin.messages())
                : items.deliveryTerminal(1, new RoleplayItems.TerminalShop(computer.shopId(), computer.shopName()), plugin.messages());
    }

    public void handleBreak(BlockBreakEvent event, ComputerBlock computer) {
        event.setCancelled(true);
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        TagResolver shopTag = Placeholder.unparsed("shop", computer.shopName());
        boolean trusted = Perm.ADMIN_BYPASS.has(player) || plugin.storageController().registry().zoneOf(computer.shopId())
                .map(zone -> zone.ownerId().equals(player.getUniqueId()))
                .orElse(false);
        // The full computer: owner or admin. A delivery terminal: also whoever may carry packages there.
        if (!trusted && computer.kind() == ComputerKind.FULL) {
            player.sendMessage(messages.get("computer.break-denied", shopTag));
            return;
        }
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null || !breaking.add(computer.id())) {
            return;
        }
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            try {
                if (!trusted && !roleplay.can(computer.shopId(), playerId, ShopPermission.ORDERS_PACKAGE.key())) {
                    breaking.remove(computer.id());
                    player.sendMessage(messages.get("computer.break-denied", shopTag));
                    return;
                }
                boolean deleted = roleplay.deleteComputer(computer.id());
                registry.remove(computer.id());
                runOnMainThread(() -> {
                    breaking.remove(computer.id());
                    if (!deleted) {
                        return;
                    }
                    Block block = blockAt(computer.position());
                    if (block != null && !block.isEmpty()) {
                        if (block.getState() instanceof Container container) {
                            container.getInventory().clear();
                        }
                        block.setType(Material.AIR);
                        block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5), itemOf(computer));
                    }
                    player.sendMessage(messages.get("computer.removed", shopTag));
                });
            } catch (SQLException e) {
                breaking.remove(computer.id());
                plugin.getLogger().log(Level.WARNING, "Could not remove computer " + computer.id(), e);
                player.sendMessage(messages.get("computer.failed"));
            }
        });
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
                    notifyBuyerFailed(failed.order(), failed.reason());
                }
                case ClaimResult.Claimed claimed -> chargeAndAccept(player, claimed.order(), view, economy, orders);
            }
        });
    }

    private void chargeAndAccept(Player player, ClaimedOrder order, ShopOrderView view, Economy economy,
                                 OrderRepository orders) {
        Messages messages = plugin.messages();
        runOnMainThread(() -> {
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
                        notifyBuyerFailed(order, outcome.get());
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
                    runOnMainThread(() -> {
                        if (player.isOnline()) {
                            // The package is not printed on its own: staff print it from the order screen.
                            plugin.sounds().play(player, Sounds.Event.SUCCESS);
                            player.sendMessage(messages.get(order.toMailbox() ? "computer.accepted-hand" : "computer.accepted",
                                    Placeholder.unparsed("title", order.title()),
                                    Placeholder.unparsed("locker", order.lockerName())));
                        }
                        notifyOnline(order.buyerId(), messages.get("order.accepted",
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
                    notifyBuyerRejected(view);
                } else {
                    player.sendMessage(messages.get("computer.order-gone"));
                }
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not reject order " + view.id(), e);
                player.sendMessage(messages.get("computer.failed"));
            } finally {
                busyOrders.remove(view.id());
            }
            runOnMainThread(() -> {
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
        runOnMainThread(() -> {
            payOut(new VaultWallet(economy, plugin.getServer()), order);
            if (player.isOnline()) {
                player.sendMessage(messages.get("computer.accepted-mailbox", Placeholder.unparsed("title", order.title())));
                plugin.sounds().play(player, Sounds.Event.SUCCESS);
                plugin.sounds().play(plugin.getServer().getPlayer(order.buyerId()), Sounds.Event.ORDER_READY);
            }
            notifyOnline(order.buyerId(), messages.get("order.ready-mailbox",
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
        Messages messages = plugin.messages();
        if (label.mailbox()) {
            player.sendMessage(messages.get("computer.wrong-mailbox", Placeholder.unparsed("owner", label.targetName())));
            return;
        }
        if (!label.targetId().equals(locker.id())) {
            player.sendMessage(messages.get("computer.wrong-locker", Placeholder.unparsed("locker", label.targetName())));
            return;
        }
        OrderRepository.Courier courier = courier(player);
        completeDelivery(player, label, orders -> orders.deliver(label.orderId(), locker.id(), locker.name(), courier),
                order -> messages.get("computer.delivered",
                        Placeholder.unparsed("title", order.title()), Placeholder.unparsed("locker", locker.name())),
                order -> messages.get("order.ready",
                        Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.unparsed("locker", locker.name())));
    }

    /** Main thread. Right click on the buyer's mailbox with a hand-delivered express package. */
    public void deliverToMailbox(Player player, Mailbox mailbox, RoleplayItems.PackageLabel label) {
        Messages messages = plugin.messages();
        if (!label.mailbox() || !label.targetId().equals(mailbox.id())) {
            player.sendMessage(messages.get("computer.wrong-mailbox", Placeholder.unparsed("owner", label.targetName())));
            return;
        }
        OrderRepository.Courier courier = courier(player);
        completeDelivery(player, label, orders -> orders.deliverToMailbox(label.orderId(), mailbox.id(), courier),
                order -> messages.get("computer.delivered-mailbox",
                        Placeholder.unparsed("title", order.title()), Placeholder.unparsed("owner", mailbox.ownerName())),
                order -> messages.get("order.ready-mailbox",
                        Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                        Placeholder.unparsed("title", order.title())));
    }

    /** Main thread. The player carrying a package, with the commission rules read now from config.yml. */
    private OrderRepository.Courier courier(Player player) {
        return new OrderRepository.Courier(player.getUniqueId(), courierMaxPercent());
    }

    /** Server cap on the courier's share of the goods, 0-100 (orders.roleplay.courier-max-percent). */
    public int courierMaxPercent() {
        return Math.clamp(plugin.getConfig().getInt("orders.roleplay.courier-max-percent", 50), 0, 100);
    }

    /** What one delivery does in the database: moves a PAID order to READY and claims the seller's payout. */
    private interface DeliveryCall {
        Optional<ClaimedOrder> run(OrderRepository orders) throws SQLException;
    }

    /**
     * Shared by locker and mailbox deliveries. Database thread: the order becomes READY (only once, only at its
     * target); main thread: the package leaves the inventory, the seller is paid and both sides are told.
     */
    private void completeDelivery(Player player, RoleplayItems.PackageLabel label, DeliveryCall call,
                                  Function<ClaimedOrder, Component> toDeliverer, Function<ClaimedOrder, Component> toBuyer) {
        Messages messages = plugin.messages();
        OrderRepository orders = plugin.orders();
        if (orders == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        if (!busyOrders.add(label.orderId())) {
            return;
        }
        Economy economy = plugin.economy();
        plugin.dbExecutor().execute(() -> {
            Optional<ClaimedOrder> delivered;
            try {
                delivered = call.run(orders);
            } catch (SQLException e) {
                busyOrders.remove(label.orderId());
                plugin.getLogger().log(Level.WARNING, "Could not deliver order " + label.orderId(), e);
                player.sendMessage(messages.get("computer.failed"));
                return;
            }
            runOnMainThread(() -> {
                busyOrders.remove(label.orderId());
                if (player.isOnline()) {
                    items.removePackages(player, label.orderId());
                }
                if (delivered.isEmpty()) {
                    player.sendMessage(messages.get("computer.package-invalid"));
                    return;
                }
                ClaimedOrder order = delivered.get();
                if (economy == null) {
                    releasePayout(orders, order); // Retried by runJobs once the economy is back.
                    if (order.paysCourier()) {
                        releaseCourierPayout(orders, order);
                    }
                } else {
                    var wallet = new VaultWallet(economy, plugin.getServer());
                    payOut(wallet, order);
                    if (order.paysCourier()) {
                        payCourier(wallet, order);
                    }
                }
                player.sendMessage(toDeliverer.apply(order));
                plugin.sounds().play(player, Sounds.Event.PACKAGE_DELIVERED);
                plugin.sounds().play(plugin.getServer().getPlayer(order.buyerId()), Sounds.Event.ORDER_READY);
                notifyOnline(order.buyerId(), toBuyer.apply(order));
            });
        });
    }

    /** Main thread. The payout was claimed in the database before; if it fails it is released for a retry. */
    private void payOut(OrderPayment.Wallet wallet, ClaimedOrder order) {
        boolean paid;
        try {
            paid = OrderPayment.pay(wallet, order.sellerId(),
                    order.sellerAmount(plugin.mailboxController().feeToSeller()), order.selfPurchase());
        } catch (RuntimeException e) {
            plugin.getLogger().log(Level.WARNING, "Economy error paying out order " + order.id(), e);
            paid = false;
        }
        if (!paid) {
            plugin.getLogger().warning("Could not pay seller " + order.sellerId() + " for order " + order.id() + "; retrying later.");
            OrderRepository orders = plugin.orders();
            if (orders != null) {
                releasePayout(orders, order);
            }
            return;
        }
        if (!order.selfPurchase()) {
            plugin.sounds().play(plugin.getServer().getPlayer(order.sellerId()), Sounds.Event.SALE);
            notifyOnline(order.sellerId(), plugin.messages().get("order.sold", TagResolver.resolver(
                    Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                    Placeholder.unparsed("title", order.title()),
                    Placeholder.unparsed("shop", order.shopName()),
                    Placeholder.unparsed("total", money(order.sellerAmount(plugin.mailboxController().feeToSeller()))))));
        }
    }

    /** Main thread. The commission was claimed (courier_paid_at) with the delivery; if paying fails it is released for a retry. */
    private void payCourier(OrderPayment.Wallet wallet, ClaimedOrder order) {
        UUID courier = order.courierId();
        boolean paid;
        try {
            paid = courier != null && wallet.deposit(courier, order.courierPayout());
        } catch (RuntimeException e) {
            plugin.getLogger().log(Level.WARNING, "Economy error paying the courier of order " + order.id(), e);
            paid = false;
        }
        if (!paid) {
            plugin.getLogger().warning("Could not pay courier " + courier + " for order " + order.id() + "; retrying later.");
            OrderRepository orders = plugin.orders();
            if (orders != null) {
                releaseCourierPayout(orders, order);
            }
            return;
        }
        notifyOnline(courier, plugin.messages().get(order.tip().signum() > 0 ? "order.courier-paid-tip" : "order.courier-paid",
                TagResolver.resolver(
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.unparsed("shop", order.shopName()),
                        Placeholder.unparsed("amount", money(order.courierPayout())),
                        Placeholder.unparsed("tip", money(order.tip())))));
    }

    private void releaseCourierPayout(OrderRepository orders, ClaimedOrder order) {
        plugin.dbExecutor().execute(() -> {
            try {
                orders.clearCourierPayout(order.id());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.SEVERE, "Courier " + order.courierId() + " of order " + order.id() + " was not paid "
                        + order.courierPayout() + " and the payout could not be queued again. Pay them by hand.", e);
            }
        });
    }

    private String money(BigDecimal amount) {
        Economy economy = plugin.economy();
        return economy == null ? amount.toPlainString() : economy.format(amount.doubleValue());
    }

    private void releasePayout(OrderRepository orders, ClaimedOrder order) {
        plugin.dbExecutor().execute(() -> {
            try {
                orders.clearPayout(order.id());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.SEVERE, "Seller of order " + order.id() + " was not paid " + order.total()
                        + " and the payout could not be queued again. Pay them by hand.", e);
            }
        });
    }

    public void addMember(Player owner, String slug, String playerName) {
        memberAction(owner, slug, playerName, true);
    }

    public void removeMember(Player owner, String slug, String playerName) {
        memberAction(owner, slug, playerName, false);
    }

    private void memberAction(Player requester, String slug, String playerName, boolean add) {
        Messages messages = plugin.messages();
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            requester.sendMessage(messages.get("error.database-required"));
            return;
        }
        UUID requesterId = requester.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(requester);
        TagResolver tags = TagResolver.resolver(Placeholder.unparsed("player", playerName), Placeholder.unparsed("slug", slug));
        plugin.dbExecutor().execute(() -> {
            try {
                var result = add ? roleplay.addMember(slug, requesterId, admin, playerName)
                        : roleplay.removeMember(slug, requesterId, admin, playerName);
                requester.sendMessage(messages.get("employee." + result.name().toLowerCase().replace('_', '-'), tags));
                // Chat is not in the server log: record the outcome so problems can be traced.
                plugin.getLogger().info("Employee " + (add ? "add" : "remove") + " by " + requester.getName() + ": "
                        + playerName + " @ " + slug + " -> " + result);
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not change employees of " + slug, e);
                requester.sendMessage(messages.get("computer.failed"));
            }
        });
    }

    public void listMembers(Player requester, String slug) {
        Messages messages = plugin.messages();
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            requester.sendMessage(messages.get("error.database-required"));
            return;
        }
        UUID requesterId = requester.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(requester);
        TagResolver slugTag = Placeholder.unparsed("slug", slug);
        plugin.dbExecutor().execute(() -> {
            try {
                var names = roleplay.listMembers(slug, requesterId, admin);
                if (names.isEmpty()) {
                    requester.sendMessage(messages.get("employee.not-allowed", slugTag));
                } else if (names.get().isEmpty()) {
                    requester.sendMessage(messages.get("employee.list-empty", slugTag));
                } else {
                    requester.sendMessage(messages.get("employee.list", slugTag,
                            Placeholder.unparsed("players", String.join(", ", names.get()))));
                }
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not list employees of " + slug, e);
                requester.sendMessage(messages.get("computer.failed"));
            }
        });
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

    private void notifyBuyerFailed(ClaimedOrder order, FailureReason reason) {
        Messages messages = plugin.messages();
        runOnMainThread(() -> notifyOnline(order.buyerId(),
                messages.get(reason.status().equals("REFUNDED") ? "order.refunded" : "order.failed",
                        Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.component("reason", messages.plain("order.reason." + reason.name())))));
    }

    /** Rejections come from the shop's view, which has the buyer's name but not the uuid. */
    private void notifyBuyerRejected(ShopOrderView view) {
        Messages messages = plugin.messages();
        runOnMainThread(() -> {
            Player buyer = plugin.getServer().getPlayerExact(view.buyerName());
            if (buyer != null) {
                buyer.sendMessage(messages.get("order.failed",
                        Placeholder.unparsed("quantity", String.valueOf(view.quantity())),
                        Placeholder.unparsed("title", view.title()),
                        Placeholder.component("reason", messages.plain("order.reason." + FailureReason.SHOP_REJECTED.name()))));
            }
        });
    }

    /** Main thread. */
    private void notifyOnline(UUID playerId, Component message) {
        Player player = plugin.getServer().getPlayer(playerId);
        if (player != null) {
            player.sendMessage(message);
        }
    }

    private Block blockAt(BlockPosition position) {
        var world = plugin.getServer().getWorld(position.world());
        return world == null ? null : world.getBlockAt(position.x(), position.y(), position.z());
    }

    private void runOnMainThread(Runnable task) {
        if (plugin.isEnabled()) {
            plugin.getServer().getScheduler().runTask(plugin, task);
        }
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
