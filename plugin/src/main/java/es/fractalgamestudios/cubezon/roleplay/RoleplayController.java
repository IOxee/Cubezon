package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.OrderRepository;
import es.fractalgamestudios.cubezon.database.OrderRepository.ClaimResult;
import es.fractalgamestudios.cubezon.database.RoleplayRepository;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.locker.Locker;
import es.fractalgamestudios.cubezon.order.ClaimedOrder;
import es.fractalgamestudios.cubezon.order.FailureReason;
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
 */
public final class RoleplayController {

    private final CubezonPlugin plugin;
    private final ComputerRegistry registry = new ComputerRegistry();
    private final RoleplayItems items;
    private final SpecialItemShop itemShop;
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
        plugin.dbExecutor().execute(() -> {
            try {
                roleplay.publishSetting("orders_mode", plugin.orderMode().key());
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
                List<ClaimedOrder> expired = roleplay ? orders.expireAccepted(deliverHours) : List.of();
                List<ClaimedOrder> payouts = orders.claimPendingPayouts();
                if (expired.isEmpty() && payouts.isEmpty()) {
                    return;
                }
                runOnMainThread(() -> {
                    var wallet = new VaultWallet(economy, plugin.getServer());
                    for (ClaimedOrder order : expired) {
                        if (!OrderPayment.pay(wallet, order.buyerId(), order.charged(), order.selfPurchase())) {
                            plugin.getLogger().severe("Order " + order.id() + " expired undelivered (REFUNDED) but the refund of "
                                    + order.total() + " to buyer " + order.buyerId() + " failed. Give it back by hand.");
                        }
                        notifyBuyerFailed(order, FailureReason.DELIVERY_EXPIRED);
                    }
                    for (ClaimedOrder order : payouts) {
                        payOut(wallet, order);
                    }
                });
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not run the order jobs", e);
            }
        });
    }

    public void handlePlace(BlockPlaceEvent event) {
        if (!items.isComputer(event.getItemInHand())) {
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
        if (zone == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("computer.outside-zone"));
            return;
        }
        if (!zone.ownerId().equals(player.getUniqueId()) && !player.hasPermission("cubezon.admin")) {
            event.setCancelled(true);
            player.sendMessage(messages.get("storage.not-yours", Placeholder.unparsed("shop", zone.shopName())));
            return;
        }
        UUID playerId = player.getUniqueId();
        Material placedType = event.getBlockPlaced().getType();
        plugin.dbExecutor().execute(() -> {
            try {
                registry.put(roleplay.insertComputer(zone, position, playerId));
                player.sendMessage(messages.get("computer.placed", Placeholder.unparsed("shop", zone.shopName())));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not register the computer at " + position, e);
                runOnMainThread(() -> {
                    Block placed = blockAt(position);
                    if (placed != null && placed.getType() == placedType) {
                        placed.setType(Material.AIR);
                    }
                    if (player.isOnline()) {
                        SpecialItemShop.giveOrDrop(player, items.computer(1, messages));
                        player.sendMessage(messages.get("computer.place-failed"));
                    }
                });
            }
        });
    }

    public void handleBreak(BlockBreakEvent event, ComputerBlock computer) {
        event.setCancelled(true);
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        TagResolver shopTag = Placeholder.unparsed("shop", computer.shopName());
        boolean owner = plugin.storageController().registry().zoneOf(computer.shopId())
                .map(zone -> zone.ownerId().equals(player.getUniqueId()))
                .orElse(false);
        if (!owner && !player.hasPermission("cubezon.admin")) {
            player.sendMessage(messages.get("computer.break-denied", shopTag));
            return;
        }
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null || !breaking.add(computer.id())) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
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
                        block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5),
                                items.computer(1, messages));
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
        player.sendMessage(plugin.messages().get("computer.package-reprinted",
                Placeholder.unparsed("locker", order.lockerName())));
    }

    void accept(Player player, ComputerBlock computer, ShopOrderView view) {
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
        boolean admin = player.hasPermission("cubezon.admin");
        plugin.dbExecutor().execute(() -> {
            ClaimResult result;
            try {
                if (!admin && !mayDecide(computer.shopId(), deciderId)) {
                    busyOrders.remove(view.id());
                    player.sendMessage(messages.get("panel.no-permission"));
                    plugin.sounds().play(player, Sounds.Event.ERROR);
                    return;
                }
                result = orders.claimById(view.id(), computer.shopId(), OrderProcessor::isValidItem);
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
                    if (order.toMailbox()) {
                        acceptIntoMailbox(player, order, orders, economy);
                        return;
                    }
                    if (!orders.markAccepted(order.id())) {
                        plugin.getLogger().severe("Order " + order.id() + " was charged but is no longer claimed; check it by hand"
                                + " (buyer " + order.buyerId() + ", " + order.total() + ").");
                        return;
                    }
                    runOnMainThread(() -> {
                        if (player.isOnline()) {
                            SpecialItemShop.giveOrDrop(player, packageOf(view));
                            plugin.sounds().play(player, Sounds.Event.SUCCESS);
                            player.sendMessage(messages.get("computer.accepted",
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
        boolean admin = player.hasPermission("cubezon.admin");
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
        if (!label.lockerId().equals(locker.id())) {
            player.sendMessage(messages.get("computer.wrong-locker", Placeholder.unparsed("locker", label.lockerName())));
            return;
        }
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
                delivered = orders.deliver(label.orderId(), locker.id(), locker.name());
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
                } else {
                    payOut(new VaultWallet(economy, plugin.getServer()), order);
                }
                player.sendMessage(messages.get("computer.delivered",
                        Placeholder.unparsed("title", order.title()), Placeholder.unparsed("locker", locker.name())));
                plugin.sounds().play(player, Sounds.Event.PACKAGE_DELIVERED);
                plugin.sounds().play(plugin.getServer().getPlayer(order.buyerId()), Sounds.Event.ORDER_READY);
                notifyOnline(order.buyerId(), messages.get("order.ready",
                        Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.unparsed("locker", locker.name())));
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
                    Placeholder.unparsed("total", plugin.economy() == null ? order.total().toPlainString()
                            : plugin.economy().format(order.total().doubleValue())))));
        }
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
        boolean admin = requester.hasPermission("cubezon.admin");
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
        boolean admin = requester.hasPermission("cubezon.admin");
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
        return items.packageFor(new RoleplayItems.PackageLabel(view.id(), view.lockerId(), view.lockerName(), view.title()),
                view.quantity(), plugin.messages());
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
}
