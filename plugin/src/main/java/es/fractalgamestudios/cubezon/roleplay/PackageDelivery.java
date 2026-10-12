package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.OrderRepository;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.Locker;
import es.fractalgamestudios.cubezon.mailbox.Mailbox;
import es.fractalgamestudios.cubezon.order.ClaimedOrder;
import es.fractalgamestudios.cubezon.order.VaultWallet;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.entity.Player;

import java.sql.SQLException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.IntSupplier;
import java.util.logging.Level;

/** A package carried to its locker or mailbox: the order becomes READY and the seller and courier are paid. */
final class PackageDelivery {

    private final CubezonPlugin plugin;
    private final RoleplayKit kit;
    private final RoleplayItems items;
    private final RoleplayPayouts payouts;
    /** Shared with accept and reject (RoleplayController): one order, one action in flight. */
    private final Set<UUID> busyOrders;
    private final IntSupplier courierMaxPercent;

    PackageDelivery(CubezonPlugin plugin, RoleplayKit kit, RoleplayItems items, RoleplayPayouts payouts,
                    Set<UUID> busyOrders, IntSupplier courierMaxPercent) {
        this.plugin = plugin;
        this.kit = kit;
        this.items = items;
        this.payouts = payouts;
        this.busyOrders = busyOrders;
        this.courierMaxPercent = courierMaxPercent;
    }

    /** Main thread. Right click on a locker holding a package. */
    void deliver(Player player, Locker locker, RoleplayItems.PackageLabel label) {
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
    void deliverToMailbox(Player player, Mailbox mailbox, RoleplayItems.PackageLabel label) {
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
        return new OrderRepository.Courier(player.getUniqueId(), courierMaxPercent.getAsInt());
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
            kit.runOnMainThread(() -> {
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
                    payouts.releasePayout(orders, order); // Retried by runJobs once the economy is back.
                    if (order.paysCourier()) {
                        payouts.releaseCourierPayout(orders, order);
                    }
                } else {
                    var wallet = new VaultWallet(economy, plugin.getServer());
                    payouts.payOut(wallet, order);
                    if (order.paysCourier()) {
                        payouts.payCourier(wallet, order);
                    }
                }
                player.sendMessage(toDeliverer.apply(order));
                plugin.sounds().play(player, Sounds.Event.PACKAGE_DELIVERED);
                plugin.sounds().play(plugin.getServer().getPlayer(order.buyerId()), Sounds.Event.ORDER_READY);
                kit.notifyOnline(order.buyerId(), toBuyer.apply(order));
            });
        });
    }
}
