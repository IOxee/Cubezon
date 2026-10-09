package es.fractalgamestudios.cubezon.shop;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.ShopSlotsRepository;
import es.fractalgamestudios.cubezon.database.ShopSlotsRepository.Slots;
import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.command.CommandSender;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.logging.Level;

/**
 * /cz shop settings slots (OP): how many shops a player may have. The default comes from config.yml
 * (shops.default-slots) and is published for the web and the database at startup; the limit
 * itself is enforced by a trigger on shops.
 */
public final class ShopSlotsController {

    public static final int MAX_SLOTS = 100;

    private final CubezonPlugin plugin;

    public ShopSlotsController(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    public int defaultSlots() {
        return Math.clamp(plugin.getConfig().getInt("shops.default-slots", 1), 0, MAX_SLOTS);
    }

    /** In how many shops a player may work as an employee (global). */
    public int maxMemberships() {
        return Math.clamp(plugin.getConfig().getInt("shops.max-memberships", 1), 0, MAX_SLOTS);
    }

    /** Startup and /cz reload: the database reads both limits from plugin_settings. */
    public void publishDefault() {
        var roleplay = plugin.roleplay();
        if (roleplay == null) {
            return;
        }
        int slots = defaultSlots();
        int memberships = maxMemberships();
        int maxRoles = Math.clamp(plugin.getConfig().getInt("roles.max-per-shop", 10), 1, 50);
        String defaultRoles = defaultRolesJson();
        plugin.dbExecutor().execute(() -> {
            try {
                roleplay.publishSetting("default_shop_slots", String.valueOf(slots));
                roleplay.publishSetting("max_shop_memberships", String.valueOf(memberships));
                roleplay.publishSetting("max_shop_roles", String.valueOf(maxRoles));
                roleplay.publishSetting("default_shop_roles", defaultRoles);
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not publish the default shop slots", e);
            }
        });
    }

    public void show(CommandSender sender, String playerName) {
        ShopSlotsRepository repository = repository(sender);
        if (repository == null) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                repository.find(playerName).ifPresentOrElse(
                        slots -> sender.sendMessage(plugin.messages().get("slots.show", tags(slots))),
                        () -> unknown(sender, playerName));
            } catch (SQLException e) {
                fail(sender, e);
            }
        });
    }

    /** {@code value}: a number from 0 to 100, or "reset" to go back to the default. */
    public void set(CommandSender sender, String playerName, String value) {
        Messages messages = plugin.messages();
        ShopSlotsRepository repository = repository(sender);
        if (repository == null) {
            return;
        }
        Integer slots;
        if (value.toLowerCase(Locale.ROOT).equals("reset")) {
            slots = null;
        } else {
            try {
                slots = Integer.parseInt(value);
            } catch (NumberFormatException e) {
                slots = -1;
            }
            if (slots < 0 || slots > MAX_SLOTS) {
                sender.sendMessage(messages.get("slots.invalid", Placeholder.unparsed("max", String.valueOf(MAX_SLOTS))));
                return;
            }
        }
        Integer newSlots = slots;
        plugin.dbExecutor().execute(() -> {
            try {
                if (!repository.set(playerName, newSlots)) {
                    unknown(sender, playerName);
                    return;
                }
                Slots result = repository.find(playerName).orElseThrow();
                sender.sendMessage(messages.get("slots.set", tags(result)));
                plugin.getLogger().info("Shop slots of " + result.playerName() + " set to "
                        + (newSlots == null ? "default (" + result.slots() + ")" : newSlots) + " by " + sender.getName());
            } catch (SQLException e) {
                fail(sender, e);
            }
        });
    }

    /**
     * config.yml roles.defaults as JSON for the database, which creates them in every new shop.
     * Unknown permissions are dropped there too.
     */
    String defaultRolesJson() {
        JsonArray roles = new JsonArray();
        for (Map<?, ?> entry : plugin.getConfig().getMapList("roles.defaults")) {
            Object name = entry.get("name");
            if (name == null || String.valueOf(name).isBlank()) {
                continue;
            }
            JsonObject role = new JsonObject();
            role.addProperty("name", String.valueOf(name).strip());
            role.addProperty("default", Boolean.TRUE.equals(entry.get("default")));
            JsonArray permissions = new JsonArray();
            if (entry.get("permissions") instanceof List<?> list) {
                list.forEach(permission -> permissions.add(String.valueOf(permission)));
            }
            role.add("permissions", permissions);
            roles.add(role);
        }
        return roles.toString();
    }

    private TagResolver tags(Slots slots) {
        return TagResolver.resolver(
                Placeholder.unparsed("player", slots.playerName()),
                Placeholder.unparsed("slots", String.valueOf(slots.slots())),
                Placeholder.unparsed("used", String.valueOf(slots.used())),
                Placeholder.unparsed("free", String.valueOf(slots.free())),
                Placeholder.component("origin", plugin.messages().plain(slots.custom() ? "slots.custom" : "slots.default")));
    }

    private ShopSlotsRepository repository(CommandSender sender) {
        ShopSlotsRepository repository = plugin.shopSlots();
        if (repository == null) {
            sender.sendMessage(plugin.messages().get("error.database-required"));
        }
        return repository;
    }

    private void unknown(CommandSender sender, String playerName) {
        sender.sendMessage(plugin.messages().get("employee.player-not-found", Placeholder.unparsed("player", playerName)));
    }

    private void fail(CommandSender sender, SQLException e) {
        plugin.getLogger().log(Level.WARNING, "Shop slots query failed", e);
        sender.sendMessage(plugin.messages().get("storage.failed"));
    }
}
