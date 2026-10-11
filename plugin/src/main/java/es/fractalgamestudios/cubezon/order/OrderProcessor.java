package es.fractalgamestudios.cubezon.order;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.OrderRepository;
import es.fractalgamestudios.cubezon.database.OrderRepository.ClaimResult;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.sql.SQLException;
import java.util.Optional;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;

/**
 * Turns PENDING orders created by the web into READY ones, one at a time:
 * claim + reserve units (database) → charge buyer and pay seller (main thread, Vault) →
 * PAID → READY (database). Any problem before the charge fails the order without moving money;
 * a failed payout refunds the buyer. Orders left half-done by a stop are failed on startup.
 */
public final class OrderProcessor {

    private static final int FINISH_ATTEMPTS = 3;
    private static final long FINISH_RETRY_MILLIS = 2000;

    private final CubezonPlugin plugin;
    private final AtomicBoolean running = new AtomicBoolean();

    public OrderProcessor(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Startup: fails orders a previous run left claimed but unfinished, then starts polling every
     * {@code pollTicks}. Polling only starts afterwards, so recovery never sees a fresh claim.
     */
    public void start(long pollTicks) {
        OrderRepository orders = plugin.orders();
        if (orders == null) {
            schedulePolling(pollTicks);
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                for (var order : orders.recoverInterrupted()) {
                    plugin.getLogger().severe("Order " + order.orderId() + " was interrupted while being processed and is now"
                            + " FAILED (INTERRUPTED). Check whether buyer " + order.buyerId() + " was charged "
                            + order.total() + " and refund them by hand if so.");
                }
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not recover interrupted orders", e);
            }
            if (plugin.isEnabled()) {
                plugin.getServer().getScheduler().runTask(plugin, () -> schedulePolling(pollTicks));
            }
        });
    }

    /** Only automatic mode processes orders by itself; in roleplay mode each shop does it. */
    private void schedulePolling(long pollTicks) {
        if (plugin.orderMode() == OrderMode.AUTOMATIC) {
            plugin.getServer().getScheduler().runTaskTimer(plugin, this::poll, pollTicks, pollTicks);
        }
    }

    /** How long a new order waits before it is processed (config.yml orders.automatic; /cz reload applies it). */
    public OrderDelay delay() {
        return OrderDelay.fromConfig(plugin.getConfig());
    }

    /** Called by the poll timer on the main thread. */
    public void poll() {
        OrderRepository orders = plugin.orders();
        Economy economy = plugin.economy();
        if (orders == null || economy == null || !running.compareAndSet(false, true)) {
            return;
        }
        processNext(orders, new VaultWallet(economy, plugin.getServer()), economy, 0);
    }

    private void processNext(OrderRepository orders, OrderPayment.Wallet wallet, Economy economy, int handled) {
        // Orders handled per poll (config.yml orders.per-run), so a long queue never hogs the database threads.
        if (handled >= Math.clamp(plugin.getConfig().getInt("orders.per-run", 20), 1, 500) || !plugin.isEnabled()) {
            running.set(false);
            return;
        }
        execute(() -> {
            ClaimResult result;
            try {
                result = orders.claimNext(OrderProcessor::isValidItem, delay());
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not claim the next order", e);
                running.set(false);
                return;
            }
            switch (result) {
                case ClaimResult.None none -> running.set(false);
                case ClaimResult.Failed failed -> {
                    notifyFailed(failed.order(), failed.reason());
                    processNext(orders, wallet, economy, handled + 1);
                }
                case ClaimResult.Claimed claimed -> charge(orders, wallet, economy, claimed.order(), handled);
            }
        });
    }

    /** Main thread: Vault. If the plugin is stopping, the order stays claimed and is recovered on startup. */
    private void charge(OrderRepository orders, OrderPayment.Wallet wallet, Economy economy, ClaimedOrder order, int handled) {
        if (!plugin.isEnabled()) {
            running.set(false);
            return;
        }
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            Optional<FailureReason> failure;
            try {
                failure = OrderPayment.charge(wallet, order, plugin.mailboxController().feeToSeller());
            } catch (RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Economy error while charging order " + order.id(), e);
                failure = Optional.of(FailureReason.PAYMENT_ERROR);
            }
            Optional<FailureReason> outcome = failure;
            execute(() -> {
                if (outcome.isEmpty()) {
                    finish(orders, order, economy);
                } else {
                    failClaimed(orders, order, outcome.get());
                }
                processNext(orders, wallet, economy, handled + 1);
            });
        });
    }

    private void finish(OrderRepository orders, ClaimedOrder order, Economy economy) {
        for (int attempt = 1; attempt <= FINISH_ATTEMPTS; attempt++) {
            try {
                if (orders.finish(order.id())) {
                    notifyReady(order, economy);
                } else {
                    plugin.getLogger().severe("Order " + order.id() + " was charged but was no longer PENDING;"
                            + " check it by hand (buyer " + order.buyerId() + ", " + order.total() + ").");
                }
                return;
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not mark order " + order.id() + " READY (attempt "
                        + attempt + "/" + FINISH_ATTEMPTS + ")", e);
                sleep(FINISH_RETRY_MILLIS);
            }
        }
        plugin.getLogger().severe("Order " + order.id() + " WAS CHARGED (buyer " + order.buyerId() + " paid "
                + order.total() + " to seller " + order.sellerId() + ") but could not be marked READY. On the next"
                + " start it will be failed as INTERRUPTED: deliver it or refund it by hand.");
    }

    private void failClaimed(OrderRepository orders, ClaimedOrder order, FailureReason reason) {
        if (reason == FailureReason.REFUND_FAILED) {
            plugin.getLogger().severe("Order " + order.id() + ": buyer " + order.buyerId() + " was charged " + order.total()
                    + ", the seller could not be paid and the refund failed. Give the money back by hand.");
        }
        try {
            orders.fail(order.id(), reason);
        } catch (SQLException | RuntimeException e) {
            plugin.getLogger().log(Level.WARNING, "Could not fail order " + order.id() + " (" + reason
                    + "); it will be recovered as INTERRUPTED on the next start", e);
        }
        notifyFailed(order, reason);
    }

    private void notifyReady(ClaimedOrder order, Economy economy) {
        Messages messages = plugin.messages();
        TagResolver tags = tags(order, economy);
        notify(() -> {
            Player buyer = plugin.getServer().getPlayer(order.buyerId());
            if (buyer != null) {
                buyer.sendMessage(messages.get(order.toMailbox() ? "order.ready-mailbox" : "order.ready", tags));
                plugin.sounds().play(buyer, Sounds.Event.ORDER_READY);
            }
            Player seller = plugin.getServer().getPlayer(order.sellerId());
            if (seller != null && !order.selfPurchase()) {
                seller.sendMessage(messages.get("order.sold", tags));
                plugin.sounds().play(seller, Sounds.Event.SALE);
            }
        });
    }

    private void notifyFailed(ClaimedOrder order, FailureReason reason) {
        Messages messages = plugin.messages();
        notify(() -> {
            Player buyer = plugin.getServer().getPlayer(order.buyerId());
            if (buyer != null) {
                buyer.sendMessage(messages.get(reason.status().equals("REFUNDED") ? "order.refunded" : "order.failed",
                        Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.component("reason", messages.plain("order.reason." + reason.name()))));
            }
        });
    }

    private void notify(Runnable task) {
        if (plugin.isEnabled()) {
            plugin.getServer().getScheduler().runTask(plugin, task);
        }
    }

    private static TagResolver tags(ClaimedOrder order, Economy economy) {
        return TagResolver.resolver(
                Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                Placeholder.unparsed("title", order.title()),
                Placeholder.unparsed("shop", order.shopName()),
                Placeholder.unparsed("locker", order.lockerName()),
                Placeholder.unparsed("total", economy.format(order.total().doubleValue())));
    }

    /** Escrow data that cannot be turned back into an item fails the order instead of crashing. */
    public static boolean isValidItem(byte[] data) {
        try {
            return !ItemStack.deserializeBytes(data).isEmpty();
        } catch (RuntimeException | LinkageError e) {
            return false;
        }
    }

    private void execute(Runnable task) {
        try {
            plugin.dbExecutor().execute(task);
        } catch (RejectedExecutionException e) {
            running.set(false); // Shutting down: claimed orders are recovered on the next start.
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
