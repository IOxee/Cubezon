package es.fractalgamestudios.cubezon.listener;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.PlayerRepository;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import java.sql.SQLException;
import java.util.UUID;
import java.util.logging.Level;

/** Keeps public.players up to date (name changes, last seen). */
public final class PlayerJoinListener implements Listener {

    private final CubezonPlugin plugin;

    public PlayerJoinListener(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        PlayerRepository players = plugin.players();
        if (players == null) {
            return;
        }
        Player player = event.getPlayer();
        UUID playerId = player.getUniqueId();
        String name = player.getName();
        plugin.dbExecutor().execute(() -> {
            try {
                players.upsert(playerId, name);
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not save player " + name, e);
            }
        });
    }
}
