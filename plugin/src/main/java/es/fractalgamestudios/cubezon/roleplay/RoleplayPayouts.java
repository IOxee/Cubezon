package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.OrderRepository;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.order.ClaimedOrder;
import es.fractalgamestudios.cubezon.order.FailureReason;
import es.fractalgamestudios.cubezon.order.OrderPayment;
import es.fractalgamestudios.cubezon.order.VaultWallet;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.logging.Level;

/**
 * Money moved after an order is claimed: seller payouts, courier commissions and refunds of expired
 * deliveries. Each payout was marked in the database before; a failed payment releases the mark so
 * runJobs retries it, never paying twice.
 */
final class RoleplayPayouts {

    private final CubezonPlugin plugin;
    private final RoleplayKit kit;

    RoleplayPayouts(CubezonPlugin plugin, RoleplayKit kit) {
        this.plugin = plugin;
        this.kit = kit;
    }

    /** Database thread. Pays each claimed order on the main thread. */
    void payOnMainThread(Economy economy, List<ClaimedOrder> claimed,
                         BiConsumer<OrderPayment.Wallet, ClaimedOrder> pay) {
        if (claimed.isEmpty()) {
            return;
        }
        kit.runOnMainThread(() -> {
            var wallet = new VaultWallet(economy, plugin.getServer());
            for (ClaimedOrder order : claimed) {
                pay.accept(wallet, order);
            }
        });
    }

    /** Main thread. The order is already REFUNDED in the database; the buyer gets the money back. */
    void refundExpired(OrderPayment.Wallet wallet, ClaimedOrder order) {
        if (!OrderPayment.pay(wallet, order.buyerId(), order.charged(), order.selfPurchase())) {
            plugin.getLogger().severe("Order " + order.id() + " expired undelivered (REFUNDED) but the refund of "
                    + order.charged() + " to buyer " + order.buyerId() + " failed. Give it back by hand.");
        }
        kit.notifyBuyerFailed(order, FailureReason.DELIVERY_EXPIRED);
    }

    /** Main thread. The payout was claimed in the database before; if it fails it is released for a retry. */
    void payOut(OrderPayment.Wallet wallet, ClaimedOrder order) {
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
            kit.notifyOnline(order.sellerId(), plugin.messages().get("order.sold", TagResolver.resolver(
                    Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                    Placeholder.unparsed("title", order.title()),
                    Placeholder.unparsed("shop", order.shopName()),
                    Placeholder.unparsed("total", kit.money(order.sellerAmount(plugin.mailboxController().feeToSeller()))))));
        }
    }

    /** Main thread. The commission was claimed (courier_paid_at) with the delivery; if paying fails it is released for a retry. */
    void payCourier(OrderPayment.Wallet wallet, ClaimedOrder order) {
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
        kit.notifyOnline(courier, plugin.messages().get(order.tip().signum() > 0 ? "order.courier-paid-tip" : "order.courier-paid",
                TagResolver.resolver(
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.unparsed("shop", order.shopName()),
                        Placeholder.unparsed("amount", kit.money(order.courierPayout())),
                        Placeholder.unparsed("tip", kit.money(order.tip())))));
    }

    void releaseCourierPayout(OrderRepository orders, ClaimedOrder order) {
        plugin.dbExecutor().execute(() -> {
            try {
                orders.clearCourierPayout(order.id());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.SEVERE, "Courier " + order.courierId() + " of order " + order.id() + " was not paid "
                        + order.courierPayout() + " and the payout could not be queued again. Pay them by hand.", e);
            }
        });
    }

    void releasePayout(OrderRepository orders, ClaimedOrder order) {
        plugin.dbExecutor().execute(() -> {
            try {
                orders.clearPayout(order.id());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.SEVERE, "Seller of order " + order.id() + " was not paid " + order.total()
                        + " and the payout could not be queued again. Pay them by hand.", e);
            }
        });
    }
}
