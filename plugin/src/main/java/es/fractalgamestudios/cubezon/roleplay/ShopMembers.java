package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.database.RoleplayRepository;
import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.entity.Player;

import java.sql.SQLException;
import java.util.UUID;
import java.util.logging.Level;

/** The employee commands (/cz employee add|remove|list); every check is done in the database. */
final class ShopMembers {

    private final CubezonPlugin plugin;

    ShopMembers(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    void addMember(Player owner, String slug, String playerName) {
        memberAction(owner, slug, playerName, true);
    }

    void removeMember(Player owner, String slug, String playerName) {
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
        boolean admin = Perm.ADMIN_BYPASS.has(requester);
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

    void listMembers(Player requester, String slug) {
        Messages messages = plugin.messages();
        RoleplayRepository roleplay = plugin.roleplay();
        if (roleplay == null) {
            requester.sendMessage(messages.get("error.database-required"));
            return;
        }
        UUID requesterId = requester.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(requester);
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
}
