package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.RoleRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.Member;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.roles.ShopRole;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.inventory.ItemStack;

import java.sql.SQLException;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** The company computer's staff screens: employees, hiring and firing, and the shop's ranks. */
final class StaffScreens {

    private final CubezonPlugin plugin;
    private final PanelKit kit;
    /** Slots and icons of the buttons (menus.yml). */
    private final MenuLayout menu;

    StaffScreens(CubezonPlugin plugin, PanelKit kit, MenuLayout menu) {
        this.plugin = plugin;
        this.kit = kit;
        this.menu = menu;
    }

    void showStaff(Player player, PanelContext context) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        kit.async(player, () -> panel.members(context.shop().id()), members -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.staff", kit.shopTags(context.shop())));
            boolean manage = context.can(ShopPermission.STAFF_MANAGE);
            List<String> lore = manage ? List.of("panel.staff.role-line", "panel.staff.manage-hint") : List.of("panel.staff.role-line");
            for (int slot = 0; slot < Math.min(members.size(), PanelKit.LIST_SLOTS); slot++) {
                Member member = members.get(slot);
                var icon = Icons.head(plugin.getServer().getOfflinePlayer(member.id()), messages, "panel.staff.member",
                        lore, Placeholder.unparsed("player", member.name()),
                        Placeholder.unparsed("role", member.roleName() == null ? "-" : member.roleName()));
                if (manage) {
                    gui.set(slot, icon, (p, click) -> showMember(p, context, member));
                } else {
                    gui.set(slot, icon);
                }
            }
            if (manage) {
                Set<UUID> current = members.stream().map(Member::id).collect(Collectors.toSet());
                gui.set(menu.slot("staff.staff-hire", 53), Icons.decorate(menu.icon("staff.staff-hire", Material.EMERALD), messages, "panel.staff.hire", List.of("panel.staff.hire-hint")),
                        (p, click) -> showHire(p, context, current));
            }
            if (context.owner()) {
                gui.set(menu.slot("staff.roles-button", 45), Icons.decorate(menu.icon("staff.roles-button", Material.NAME_TAG), messages, "panel.roles.button", List.of("panel.roles.hint")),
                        (p, click) -> showRoles(p, context));
            }
            kit.back(gui, context);
            gui.fill(menu.filler()).open(player);
        });
    }

    /** Online players who are neither the owner nor already employees. */
    private void showHire(Player player, PanelContext context, Set<UUID> current) {
        Messages messages = plugin.messages();
        Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.hire", kit.shopTags(context.shop())));
        int slot = 0;
        for (Player online : plugin.getServer().getOnlinePlayers()) {
            if (slot >= PanelKit.LIST_SLOTS) {
                break;
            }
            if (online.getUniqueId().equals(context.shop().ownerId()) || current.contains(online.getUniqueId())) {
                continue;
            }
            gui.set(slot++, Icons.head(online, messages, "panel.staff.candidate", List.of("panel.staff.candidate-hint"),
                            Placeholder.unparsed("player", online.getName())),
                    (p, click) -> changeStaff(p, context, online.getUniqueId(), online.getName(), true));
        }
        if (slot == 0) {
            gui.set(menu.slot("hire.staff-nobody", 22), Icons.decorate(menu.icon("hire.staff-nobody", Material.PAPER), messages, "panel.staff.nobody", List.of()));
        }
        gui.set(menu.slot("hire.back", PanelKit.BACK_SLOT), Icons.decorate(menu.icon("hire.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showStaff(p, context));
        gui.fill(menu.filler()).open(player);
    }

    private void changeStaff(Player player, PanelContext context, UUID memberId, String memberName, boolean hire) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null || !context.can(ShopPermission.STAFF_MANAGE)) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> hire ? panel.addMember(context.shop().id(), memberId, playerId, admin).name()
                : panel.removeMember(context.shop().id(), memberId, playerId, admin) ? "REMOVED" : "NOT_ALLOWED", result -> {
            TagResolver tags = TagResolver.resolver(Placeholder.unparsed("player", memberName),
                    Placeholder.unparsed("slug", context.shop().slug()));
            player.sendMessage(plugin.messages().get("employee." + result.toLowerCase().replace('_', '-'), tags));
            boolean changed = result.equals("ADDED") || result.equals("REMOVED");
            plugin.getLogger().info("Employee " + (hire ? "hire" : "fire") + " (computer) by " + player.getName() + ": "
                    + memberName + " @ " + context.shop().slug() + " -> " + (changed ? "OK" : "NO CHANGE"));
            showStaff(player, context);
        });
    }

    /** One employee: their role can be changed or they can be fired (staff.manage). */
    private void showMember(Player player, PanelContext context, Member member) {
        RoleRepository roles = plugin.roles();
        if (roles == null) {
            return;
        }
        kit.async(player, () -> roles.roles(context.shop().id()), list -> {
            Messages messages = plugin.messages();
            TagResolver tags = TagResolver.resolver(Placeholder.unparsed("player", member.name()),
                    Placeholder.unparsed("role", member.roleName() == null ? "-" : member.roleName()));
            Gui gui = new Gui(plugin.getServer(), 4, messages.plain("panel.titles.member", tags));
            gui.set(menu.slot("member.head", 4), Icons.head(plugin.getServer().getOfflinePlayer(member.id()), messages, "panel.staff.member",
                    List.of("panel.staff.role-line"), tags));
            int slot = 9;
            for (ShopRole role : list) {
                if (slot > 26) {
                    break;
                }
                boolean current = role.id().equals(member.roleId());
                gui.set(slot++, Icons.decorate(current ? menu.icon("member.role-current", Material.LIME_DYE) : menu.icon("member.role", Material.NAME_TAG),
                                messages, "panel.roles.role",
                                List.of(current ? "panel.roles.current" : "panel.roles.assign-hint", "panel.roles.permissions-line"),
                                roleTags(role, messages)),
                        (p, click) -> assignRole(p, context, member, role));
            }
            gui.set(menu.slot("member.staff-fire", 35), Icons.decorate(menu.icon("member.staff-fire", Material.BARRIER), messages, "panel.staff.fire", List.of("panel.staff.fire-hint"), tags),
                    (p, click) -> {
                        if (click != ClickType.SHIFT_LEFT && click != ClickType.SHIFT_RIGHT) {
                            p.sendMessage(messages.get("panel.staff.fire-confirm"));
                            return;
                        }
                        changeStaff(p, context, member.id(), member.name(), false);
                    });
            gui.set(menu.slot("member.back", 27), Icons.decorate(menu.icon("member.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showStaff(p, context));
            gui.fill(menu.filler()).open(player);
        });
    }

    private void assignRole(Player player, PanelContext context, Member member, ShopRole role) {
        RoleRepository roles = plugin.roles();
        if (roles == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> roles.assign(context.shop().id(), member.id(), role.id(), playerId, admin), result -> {
            player.sendMessage(plugin.messages().get("panel.roles.result." + result.name().toLowerCase().replace('_', '-'),
                    Placeholder.unparsed("player", member.name()), Placeholder.unparsed("role", role.name())));
            plugin.getLogger().info("Role of " + member.name() + " @ " + context.shop().slug() + " -> " + role.name()
                    + " by " + player.getName() + ": " + result);
            showStaff(player, context);
        });
    }

    private void showRoles(Player player, PanelContext context) {
        RoleRepository roles = plugin.roles();
        if (roles == null || !context.owner()) {
            return;
        }
        kit.async(player, () -> roles.roles(context.shop().id()), list -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.roles", kit.shopTags(context.shop())));
            for (int slot = 0; slot < Math.min(list.size(), PanelKit.LIST_SLOTS); slot++) {
                ShopRole role = list.get(slot);
                gui.set(slot, Icons.decorate(roleIcon(role), messages, "panel.roles.role",
                                List.of("panel.roles.members-line", "panel.roles.permissions-line", "panel.roles.edit-hint"),
                                roleTags(role, messages)),
                        (p, click) -> showRole(p, context, role));
            }
            gui.set(menu.slot("roles.roles-new", 53), Icons.decorate(menu.icon("roles.roles-new", Material.WRITABLE_BOOK), messages, "panel.roles.new", List.of("panel.roles.new-hint")),
                    (p, click) -> plugin.chatPrompt().askText(p, "prompt.role-name", 1, 24,
                            name -> changeRole(p, context, null, repo -> repo.create(context.shop().id(), p.getUniqueId(),
                                    Perm.ADMIN_BYPASS.has(p), name))));
            gui.set(menu.slot("roles.back", PanelKit.BACK_SLOT), Icons.decorate(menu.icon("roles.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showStaff(p, context));
            gui.fill(menu.filler()).open(player);
        });
    }

    /** One role: a toggle per permission, rename, make default, delete. */
    private void showRole(Player player, PanelContext context, ShopRole role) {
        Messages messages = plugin.messages();
        TagResolver tags = roleTags(role, messages);
        Gui gui = new Gui(plugin.getServer(), 4, messages.plain("panel.titles.role", tags));
        gui.set(menu.slot("role.header", 4), Icons.decorate(roleIcon(role), messages, "panel.roles.role",
                List.of("panel.roles.members-line"), tags));
        int slot = menu.slot("role.permissions-start", 10);
        for (ShopPermission permission : ShopPermission.values()) {
            boolean on = role.permissions().contains(permission);
            gui.set(slot++, Icons.decorate(on ? menu.icon("role.permission-on", Material.LIME_DYE)
                                    : menu.icon("role.permission-off", Material.GRAY_DYE), messages,
                            "permissions." + permission.textKey(), List.of(on ? "panel.roles.on" : "panel.roles.off")),
                    (p, click) -> {
                        Set<ShopPermission> changed = EnumSet.noneOf(ShopPermission.class);
                        changed.addAll(role.permissions());
                        if (on) {
                            changed.remove(permission);
                        } else {
                            changed.add(permission);
                        }
                        changeRole(p, context, role, repo -> repo.setPermissions(context.shop().id(), role.id(),
                                p.getUniqueId(), Perm.ADMIN_BYPASS.has(p), changed));
                    });
        }
        gui.set(menu.slot("role.roles-rename", 28), Icons.decorate(menu.icon("role.roles-rename", Material.NAME_TAG), messages, "panel.roles.rename", List.of()),
                (p, click) -> plugin.chatPrompt().askText(p, "prompt.role-name", 1, 24,
                        name -> changeRole(p, context, null, repo -> repo.rename(context.shop().id(), role.id(),
                                p.getUniqueId(), Perm.ADMIN_BYPASS.has(p), name))));
        if (!role.isDefault()) {
            gui.set(menu.slot("role.roles-make-default", 30), Icons.decorate(menu.icon("role.roles-make-default", Material.NETHER_STAR), messages, "panel.roles.make-default", List.of("panel.roles.make-default-hint")),
                    (p, click) -> changeRole(p, context, null, repo -> repo.makeDefault(context.shop().id(), role.id(),
                            p.getUniqueId(), Perm.ADMIN_BYPASS.has(p))));
            gui.set(menu.slot("role.roles-delete", 34), Icons.decorate(menu.icon("role.roles-delete", Material.BARRIER), messages, "panel.roles.delete", List.of("panel.roles.delete-hint")),
                    (p, click) -> {
                        if (click != ClickType.SHIFT_LEFT && click != ClickType.SHIFT_RIGHT) {
                            p.sendMessage(messages.get("panel.roles.delete-confirm"));
                            return;
                        }
                        changeRole(p, context, null, repo -> repo.delete(context.shop().id(), role.id(),
                                p.getUniqueId(), Perm.ADMIN_BYPASS.has(p)));
                    });
        }
        gui.set(menu.slot("role.back", 27), Icons.decorate(menu.icon("role.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showRoles(p, context));
        gui.fill(menu.filler()).open(player);
    }

    private interface RoleChange {
        RoleRepository.Result apply(RoleRepository roles) throws SQLException;
    }

    /** Runs a role change and reopens the role (if {@code reopen} is given, refreshed) or the role list. */
    private void changeRole(Player player, PanelContext context, ShopRole reopen, RoleChange change) {
        RoleRepository roles = plugin.roles();
        if (roles == null) {
            return;
        }
        kit.async(player, () -> {
            RoleRepository.Result result = change.apply(roles);
            List<ShopRole> refreshed = roles.roles(context.shop().id());
            return new RoleChangeOutcome(result, refreshed);
        }, outcome -> {
            if (outcome.result() != RoleRepository.Result.OK) {
                player.sendMessage(plugin.messages().get("panel.roles.result." + outcome.result().name().toLowerCase().replace('_', '-')));
            }
            ShopRole updated = reopen == null ? null
                    : outcome.roles().stream().filter(role -> role.id().equals(reopen.id())).findFirst().orElse(null);
            if (updated != null) {
                showRole(player, context, updated);
            } else {
                showRoles(player, context);
            }
        });
    }

    private record RoleChangeOutcome(RoleRepository.Result result, List<ShopRole> roles) {
    }

    private TagResolver roleTags(ShopRole role, Messages messages) {
        String permissions = role.permissions().isEmpty() ? "-" : role.permissions().stream()
                .map(permission -> net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText()
                        .serialize(messages.plain("permissions." + permission.textKey())))
                .collect(Collectors.joining(", "));
        return TagResolver.resolver(
                Placeholder.unparsed("role", role.name()),
                Placeholder.unparsed("members", String.valueOf(role.members())),
                Placeholder.unparsed("permissions", permissions),
                Placeholder.component("default", role.isDefault() ? messages.plain("panel.roles.default-mark") : Component.empty()));
    }

    private ItemStack roleIcon(ShopRole role) {
        return role.isDefault() ? menu.icon("roles.role-default", Material.NETHER_STAR) : menu.icon("roles.role", Material.NAME_TAG);
    }
}
