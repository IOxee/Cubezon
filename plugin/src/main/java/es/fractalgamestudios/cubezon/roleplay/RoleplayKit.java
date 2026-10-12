package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.order.ClaimedOrder;
import es.fractalgamestudios.cubezon.order.FailureReason;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;

import java.math.BigDecimal;
import java.util.UUID;

/** Small helpers shared by the roleplay parts: thread hops, blocks, money and player notices. */
final class RoleplayKit {

    private final CubezonPlugin plugin;

    RoleplayKit(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    void notifyBuyerFailed(ClaimedOrder order, FailureReason reason) {
        Messages messages = plugin.messages();
        runOnMainThread(() -> notifyOnline(order.buyerId(),
                messages.get(reason.status().equals("REFUNDED") ? "order.refunded" : "order.failed",
                        Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                        Placeholder.unparsed("title", order.title()),
                        Placeholder.component("reason", messages.plain("order.reason." + reason.name())))));
    }

    /** Rejections come from the shop's view, which has the buyer's name but not the uuid. */
    void notifyBuyerRejected(ShopOrderView view) {
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
    void notifyOnline(UUID playerId, Component message) {
        Player player = plugin.getServer().getPlayer(playerId);
        if (player != null) {
            player.sendMessage(message);
        }
    }

    String money(BigDecimal amount) {
        Economy economy = plugin.economy();
        return economy == null ? amount.toPlainString() : economy.format(amount.doubleValue());
    }

    Block blockAt(BlockPosition position) {
        var world = plugin.getServer().getWorld(position.world());
        return world == null ? null : world.getBlockAt(position.x(), position.y(), position.z());
    }

    void runOnMainThread(Runnable task) {
        if (plugin.isEnabled()) {
            plugin.getServer().getScheduler().runTask(plugin, task);
        }
    }
}
