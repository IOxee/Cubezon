package es.fractalgamestudios.cubezon.gui;

import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerInteractEvent;

/** Shared rules for right clicks on Cubezon blocks (storage, computer, locker). */
public final class InteractRules {

    private InteractRules() {
    }

    /**
     * Sneaking with something in either hand skips the block's own use in vanilla (that is how
     * players place blocks against chests). Cubezon blocks behave the same: the click is left alone
     * so the item is placed or used. It has to be left alone completely: once a plugin denies the
     * block interaction, Paper never uses the item in hand, whatever useItemInHand says.
     */
    public static boolean passesThrough(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        return player.isSneaking()
                && (!player.getInventory().getItemInMainHand().isEmpty() || !player.getInventory().getItemInOffHand().isEmpty());
    }
}
