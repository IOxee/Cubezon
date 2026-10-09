package es.fractalgamestudios.cubezon.locker;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.LockerRepository;
import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.Nullable;

import java.sql.SQLException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.logging.Level;

/** Locker management (admin) and the pickup entry point (players). */
public final class LockerController {


    private final CubezonPlugin plugin;
    private final LockerRegistry registry;

    public LockerController(CubezonPlugin plugin, LockerRegistry registry) {
        this.plugin = plugin;
        this.registry = registry;
    }

    /** Reloads the registry from the database (the web can toggle `active`). */
    public void refresh() {
        LockerRepository lockers = plugin.lockers();
        if (lockers == null) {
            registry.replaceAll(List.of());
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                registry.replaceAll(lockers.findAll());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not refresh lockers", e);
            }
        });
    }

    public void create(Player player, String name) {
        Messages messages = plugin.messages();
        LockerRepository lockers = requireDatabase(player);
        if (lockers == null) {
            return;
        }
        if (name.length() < 3 || name.length() > 40) {
            player.sendMessage(messages.get("locker.invalid-name"));
            return;
        }
        Block block = player.getTargetBlockExact(reach());
        if (block == null || block.isEmpty()) {
            player.sendMessage(messages.get("locker.look-at-block", radius()));
            return;
        }
        BlockPosition position = BlockPosition.of(block);
        plugin.dbExecutor().execute(() -> {
            try {
                lockers.create(name, position).ifPresentOrElse(locker -> {
                    registry.put(locker);
                    player.sendMessage(messages.get("locker.created", placeholders(locker)));
                }, () -> player.sendMessage(messages.get("locker.exists")));
            } catch (SQLException e) {
                fail(player, "Could not create locker " + name, e);
            }
        });
    }

    /** Removes a locker; with {@code moveTo}, its orders move to that locker first. */
    public void remove(CommandSender sender, String name, @Nullable String moveTo) {
        Messages messages = plugin.messages();
        LockerRepository lockers = requireDatabase(sender);
        if (lockers == null) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                var outcome = lockers.remove(name, moveTo);
                TagResolver tags = TagResolver.resolver(
                        Placeholder.unparsed("name", name),
                        Placeholder.unparsed("target", moveTo == null ? "" : moveTo),
                        Placeholder.unparsed("orders", String.valueOf(outcome.orders())));
                switch (outcome.result()) {
                    case REMOVED -> sender.sendMessage(messages.get("locker.removed", tags));
                    case MOVED -> sender.sendMessage(messages.get("locker.moved", tags));
                    case DEACTIVATED -> sender.sendMessage(messages.get("locker.deactivated", tags));
                    case NOT_FOUND -> sender.sendMessage(messages.get("locker.not-found", tags));
                    case TARGET_NOT_FOUND -> sender.sendMessage(messages.get("locker.not-found",
                            Placeholder.unparsed("name", moveTo == null ? "" : moveTo)));
                    case TARGET_INACTIVE -> sender.sendMessage(messages.get("locker.target-inactive", tags));
                    case SAME_LOCKER -> sender.sendMessage(messages.get("locker.same-locker"));
                }
                registry.replaceAll(lockers.findAll());
            } catch (SQLException e) {
                fail(sender, "Could not remove locker " + name, e);
            }
        });
    }

    public void list(CommandSender sender) {
        Messages messages = plugin.messages();
        LockerRepository lockers = requireDatabase(sender);
        if (lockers == null) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                List<Locker> all = lockers.findAll().stream().sorted(Comparator.comparing(Locker::name)).toList();
                registry.replaceAll(all);
                if (all.isEmpty()) {
                    sender.sendMessage(messages.get("locker.list-empty"));
                    return;
                }
                sender.sendMessage(messages.get("locker.list-header"));
                for (Locker locker : all) {
                    sender.sendMessage(messages.plain("locker.list-entry", placeholders(locker),
                            Placeholder.component("status",
                                    messages.plain(locker.active() ? "locker.status-active" : "locker.status-inactive"))));
                }
            } catch (SQLException e) {
                fail(sender, "Could not list lockers", e);
            }
        });
    }

    /** /cz pickup: the closest locker within reach. */
    public void pickupNearby(Player player) {
        Location location = player.getLocation();
        registry.nearest(location.getWorld().getName(), location.getX(), location.getY(), location.getZ(), reach())
                .ifPresentOrElse(locker -> openPickup(player, locker),
                        () -> player.sendMessage(plugin.messages().get("locker.none-nearby", radius())));
    }

    /** Pickup entry point (right click or /cz pickup). */
    public void openPickup(Player player, Locker locker) {
        Messages messages = plugin.messages();
        TagResolver nameTag = Placeholder.unparsed("name", locker.name());
        if (!locker.active()) {
            player.sendMessage(messages.get("locker.inactive", nameTag));
            return;
        }
        plugin.pickupController().open(player, locker);
    }

    public LockerRegistry registry() {
        return registry;
    }

    private LockerRepository requireDatabase(CommandSender sender) {
        LockerRepository lockers = plugin.lockers();
        if (lockers == null) {
            sender.sendMessage(plugin.messages().get("error.database-required"));
        }
        return lockers;
    }

    private void fail(CommandSender sender, String logMessage, SQLException e) {
        plugin.getLogger().log(Level.WARNING, logMessage, e);
        sender.sendMessage(plugin.messages().get("locker.failed"));
    }

    /** Max distance, in blocks, to target a block with create or to use /cz pickup (config.yml settings.locker-reach). */
    private int reach() {
        return Math.clamp(plugin.getConfig().getInt("settings.locker-reach", 5), 1, 32);
    }

    private TagResolver radius() {
        return Placeholder.unparsed("radius", String.valueOf(reach()));
    }

    private static TagResolver placeholders(Locker locker) {
        BlockPosition position = locker.position();
        return TagResolver.resolver(
                Placeholder.unparsed("name", locker.name()),
                Placeholder.unparsed("world", position.world()),
                Placeholder.unparsed("x", String.valueOf(position.x())),
                Placeholder.unparsed("y", String.valueOf(position.y())),
                Placeholder.unparsed("z", String.valueOf(position.z())));
    }
}
