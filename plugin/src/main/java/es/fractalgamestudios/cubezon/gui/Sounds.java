package es.fractalgamestudios.cubezon.gui;

import net.kyori.adventure.key.InvalidKeyException;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.Nullable;

/**
 * Feedback sounds, all configurable in config.yml under sounds.&lt;event&gt; (sound, volume, pitch,
 * enabled). An unknown sound key is ignored, so a typo never breaks an action.
 */
public final class Sounds {

    /** The moments that play a sound; their names are the config.yml keys. */
    public enum Event {
        MENU_CLICK("menu-click"),
        PROMPT("prompt"),
        SUCCESS("success"),
        ERROR("error"),
        ORDER_READY("order-ready"),
        SALE("sale"),
        PACKAGE_DELIVERED("package-delivered");

        private final String key;

        Event(String key) {
            this.key = key;
        }
    }

    private final Plugin plugin;

    public Sounds(Plugin plugin) {
        this.plugin = plugin;
    }

    /** Main thread or not: Adventure sounds are safe to send from any thread. */
    public void play(@Nullable Player player, Event event) {
        if (player == null || !player.isOnline()) {
            return;
        }
        ConfigurationSection section = plugin.getConfig().getConfigurationSection("sounds." + event.key);
        if (section == null || !section.getBoolean("enabled", true)) {
            return;
        }
        String name = section.getString("sound", "");
        if (name.isBlank()) {
            return;
        }
        try {
            player.playSound(Sound.sound(Key.key(name), Sound.Source.MASTER,
                    (float) section.getDouble("volume", 1.0), (float) section.getDouble("pitch", 1.0)));
        } catch (InvalidKeyException e) {
            plugin.getLogger().warning("Invalid sound in config.yml sounds." + event.key + ": " + name);
        }
    }
}
