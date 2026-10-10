package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.RoleRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.Member;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.PanelListing;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.ShopInfo;
import es.fractalgamestudios.cubezon.deposit.DepositableListing;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.ChatPrompt;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.item.ItemKey;
import es.fractalgamestudios.cubezon.order.OrderMode;
import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.roles.ShopRole;
import es.fractalgamestudios.cubezon.storage.SpecialItemShop;
import es.fractalgamestudios.cubezon.storage.StorageController;
import es.fractalgamestudios.cubezon.storage.StorageType;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.inventory.ItemStack;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.stream.Collectors;

/**
 * The company computer: the shop's control panel. Staff (owner and employees) see orders, staff,
 * listings and storage; only the owner (or an admin) hires and fires, withdraws stock and sets
 * exact samples. Every screen loads its data off the main thread and opens on it.
 */
public final class ComputerPanel {

    private static final int LIST_SLOTS = 45;
    private static final int BACK_SLOT = 49;

    /** Who is looking at which shop. */
    private record Context(ComputerBlock computer, ShopInfo shop, boolean owner, Set<ShopPermission> permissions) {

        boolean can(ShopPermission permission) {
            return permissions.contains(permission);
        }
    }

    private record Access(ShopInfo shop, Set<ShopPermission> permissions) {
    }

    private interface Load<T> {
        T load() throws SQLException;
    }

    private final CubezonPlugin plugin;
    private final RoleplayController orders;
    /** Slots and icons of the buttons (menus.yml). */
    private final MenuLayout menu;

    public ComputerPanel(CubezonPlugin plugin, RoleplayController orders) {
        this.plugin = plugin;
        this.orders = orders;
        this.menu = plugin.menuLayout();
    }

    public void open(Player player, ComputerBlock computer) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null || plugin.roleplay() == null) {
            player.sendMessage(plugin.messages().get("error.database-required"));
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = player.hasPermission("cubezon.admin");
        RoleRepository roles = plugin.roles();
        async(player, () -> {
            if (!admin && !plugin.roleplay().canUse(computer.shopId(), playerId)) {
                return null;
            }
            ShopInfo shop = panel.shopInfo(computer.shopId()).orElse(null);
            if (shop == null) {
                return null;
            }
            Set<ShopPermission> permissions = admin || roles == null
                    ? (admin ? EnumSet.allOf(ShopPermission.class) : EnumSet.noneOf(ShopPermission.class))
                    : roles.permissionsOf(computer.shopId(), playerId);
            return new Access(shop, permissions);
        }, access -> {
            if (access == null) {
                player.sendMessage(plugin.messages().get("computer.not-staff",
                        Placeholder.unparsed("shop", computer.shopName())));
                return;
            }
            showMain(player, new Context(computer, access.shop(), admin || access.shop().ownerId().equals(playerId),
                    access.permissions()));
        });
    }

    private void showMain(Player player, Context context) {
        Messages messages = plugin.messages();
        ShopInfo shop = context.shop();
        TagResolver tags = shopTags(shop);
        Gui gui = new Gui(plugin.getServer(), 3, messages.plain("panel.titles.main", tags));

        gui.set(menu.slot("main.shop-name", 4), Icons.decorate(menu.icon("main.shop-name", Material.NAME_TAG), messages, "panel.shop.name",
                List.of("panel.shop.slug", "panel.shop.owner", "panel.shop.status", "panel.shop.zone"), tags));
        if (plugin.orderMode() == OrderMode.ROLEPLAY
                && (context.can(ShopPermission.ORDERS_DECIDE) || context.can(ShopPermission.ORDERS_PACKAGE))) {
            gui.set(menu.slot("main.orders-button", 10), Icons.decorate(menu.icon("main.orders-button", Material.CHEST), messages, "panel.orders.button", List.of("panel.orders.hint"), tags),
                    (p, click) -> showOrders(p, context));
        } else if (plugin.orderMode() == OrderMode.ROLEPLAY) {
            gui.set(menu.slot("main.orders-locked", 10), Icons.decorate(menu.icon("main.orders-locked", Material.GRAY_DYE), messages, "panel.orders.button", List.of("panel.no-permission-line"), tags));
        } else {
            gui.set(menu.slot("main.orders-automatic", 10), Icons.decorate(menu.icon("main.orders-automatic", Material.GRAY_DYE), messages, "panel.orders.automatic", List.of("panel.orders.automatic-hint"), tags));
        }
        gui.set(menu.slot("main.staff-button", 12), Icons.decorate(menu.icon("main.staff-button", Material.PLAYER_HEAD), messages, "panel.staff.button", List.of("panel.staff.hint"), tags),
                (p, click) -> showStaff(p, context));
        gui.set(menu.slot("main.listings-button", 14), Icons.decorate(menu.icon("main.listings-button", Material.ITEM_FRAME), messages, "panel.listings.button", List.of("panel.listings.hint"), tags),
                (p, click) -> showListings(p, context));
        gui.set(menu.slot("main.storage-button", 16), Icons.decorate(menu.icon("main.storage-button", Material.BARREL), messages, "panel.storage.button", List.of("panel.storage.hint"), tags),
                (p, click) -> showStorage(p, context));
        gui.set(menu.slot("main.close", 22), Icons.decorate(menu.icon("main.close", Material.BARRIER), messages, "panel.close", List.of()), (p, click) -> p.closeInventory());
        gui.fill(menu.filler()).open(player);
    }

    void showOrders(Player player, Context context) {
        var roleplay = plugin.roleplay();
        if (roleplay == null) {
            return;
        }
        async(player, () -> roleplay.findShopOrders(context.computer().shopId(), LIST_SLOTS), list -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.orders",
                    shopTags(context.shop()), Placeholder.unparsed("count", String.valueOf(list.size()))));
            for (int slot = 0; slot < list.size(); slot++) {
                ShopOrderView order = list.get(slot);
                gui.set(slot, orders.orderIcon(order), (p, click) -> showOrderDecision(p, context, order));
            }
            back(gui, context);
            gui.fill(menu.filler()).open(player);
        });
    }

    /**
     * One order with the customer's data: who (head, online or not, where they are), what, to which
     * locker and since when. Pending: ✔ accepts, ✖ rejects. Accepted: reprint the package.
     */
    private void showOrderDecision(Player player, Context context, ShopOrderView order) {
        Messages messages = plugin.messages();
        var buyer = plugin.getServer().getPlayer(order.buyerId());
        var locker = order.lockerId() == null ? null : plugin.lockerController().registry().byId(order.lockerId()).orElse(null);
        Economy economy = plugin.economy();
        TagResolver tags = TagResolver.resolver(
                Placeholder.unparsed("buyer", order.buyerName()),
                Placeholder.component("presence", buyer == null ? messages.plain("panel.decision.offline")
                        : messages.plain("panel.decision.online",
                        Placeholder.unparsed("world", buyer.getWorld().getName()),
                        Placeholder.unparsed("x", String.valueOf(buyer.getLocation().getBlockX())),
                        Placeholder.unparsed("y", String.valueOf(buyer.getLocation().getBlockY())),
                        Placeholder.unparsed("z", String.valueOf(buyer.getLocation().getBlockZ())))),
                Placeholder.unparsed("title", order.title()),
                Placeholder.unparsed("quantity", String.valueOf(order.quantity())),
                Placeholder.unparsed("total", economy == null ? order.total().toPlainString()
                        : economy.format(order.total().doubleValue())),
                Placeholder.unparsed("locker", order.lockerName()),
                Placeholder.unparsed("locker_position", order.toMailbox()
                        ? (order.mailboxPosition() == null ? "?" : order.mailboxPosition())
                        : locker == null ? "?" : locker.position().world() + " "
                        + locker.position().x() + " " + locker.position().y() + " " + locker.position().z()),
                Placeholder.unparsed("age", RoleplayController.age(order.createdAt())),
                Placeholder.unparsed("order", order.id().toString().substring(0, 8)));

        Gui gui = new Gui(plugin.getServer(), 5, messages.plain("panel.titles.decision", tags));
        gui.set(menu.slot("orderDecision.buyer", 4), Icons.head(plugin.getServer().getOfflinePlayer(order.buyerId()), messages, "panel.decision.buyer",
                List.of("panel.decision.presence"), tags));
        Material material = Material.matchMaterial(order.material());
        gui.set(menu.slot("orderDecision.product", 20), Icons.decorate(new ItemStack(material != null && material.isItem() ? material : Material.PAPER), messages,
                "panel.decision.product", List.of("panel.decision.quantity", "panel.decision.total"), tags));
        gui.set(menu.slot("orderDecision.destination", 22), order.toMailbox()
                ? Icons.decorate(menu.icon("orderDecision.mailbox", plugin.mailboxController().blockMaterial()), messages,
                        "panel.decision.mailbox", List.of("panel.decision.locker-position", "panel.decision.mailbox-hint"), tags)
                : Icons.decorate(menu.icon("orderDecision.locker", Material.ENDER_CHEST), messages, "panel.decision.locker",
                        List.of("panel.decision.locker-position"), tags));
        gui.set(menu.slot("orderDecision.decision-when", 24), Icons.decorate(menu.icon("orderDecision.decision-when", Material.CLOCK), messages, "panel.decision.when", List.of("panel.decision.order-id"), tags));
        if (order.awaitingDecision() && context.can(ShopPermission.ORDERS_DECIDE)) {
            gui.set(menu.slot("orderDecision.decision-accept", 38), Icons.decorate(menu.icon("orderDecision.decision-accept", Material.LIME_CONCRETE), messages, "panel.decision.accept", List.of("panel.decision.accept-hint"), tags),
                    (p, click) -> orders.accept(p, context.computer(), order));
            gui.set(menu.slot("orderDecision.decision-reject", 42), Icons.decorate(menu.icon("orderDecision.decision-reject", Material.RED_CONCRETE), messages, "panel.decision.reject", List.of("panel.decision.reject-hint"), tags),
                    (p, click) -> orders.reject(p, context.computer(), order, () -> showOrders(p, context)));
        } else if (order.accepted() && !order.toMailbox() && context.can(ShopPermission.ORDERS_PACKAGE)) {
            gui.set(menu.slot("orderDecision.decision-reprint", 40), Icons.decorate(menu.icon("orderDecision.decision-reprint", Material.PAPER), messages, "panel.decision.reprint", List.of("panel.decision.reprint-hint"), tags),
                    (p, click) -> orders.reprintPackage(p, order));
        }
        gui.set(menu.slot("orderDecision.back", 36), Icons.decorate(menu.icon("orderDecision.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showOrders(p, context));
        gui.fill(menu.filler()).open(player);
    }

    private void showStaff(Player player, Context context) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        async(player, () -> panel.members(context.shop().id()), members -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.staff", shopTags(context.shop())));
            boolean manage = context.can(ShopPermission.STAFF_MANAGE);
            List<String> lore = manage ? List.of("panel.staff.role-line", "panel.staff.manage-hint") : List.of("panel.staff.role-line");
            for (int slot = 0; slot < Math.min(members.size(), LIST_SLOTS); slot++) {
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
            back(gui, context);
            gui.fill(menu.filler()).open(player);
        });
    }

    /** Online players who are neither the owner nor already employees. */
    private void showHire(Player player, Context context, Set<UUID> current) {
        Messages messages = plugin.messages();
        Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.hire", shopTags(context.shop())));
        int slot = 0;
        for (Player online : plugin.getServer().getOnlinePlayers()) {
            if (slot >= LIST_SLOTS) {
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
        gui.set(menu.slot("hire.back", BACK_SLOT), Icons.decorate(menu.icon("hire.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showStaff(p, context));
        gui.fill(menu.filler()).open(player);
    }

    private void changeStaff(Player player, Context context, UUID memberId, String memberName, boolean hire) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null || !context.can(ShopPermission.STAFF_MANAGE)) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = player.hasPermission("cubezon.admin");
        async(player, () -> hire ? panel.addMember(context.shop().id(), memberId, playerId, admin).name()
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
    private void showMember(Player player, Context context, Member member) {
        RoleRepository roles = plugin.roles();
        if (roles == null) {
            return;
        }
        async(player, () -> roles.roles(context.shop().id()), list -> {
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

    private void assignRole(Player player, Context context, Member member, ShopRole role) {
        RoleRepository roles = plugin.roles();
        if (roles == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = player.hasPermission("cubezon.admin");
        async(player, () -> roles.assign(context.shop().id(), member.id(), role.id(), playerId, admin), result -> {
            player.sendMessage(plugin.messages().get("panel.roles.result." + result.name().toLowerCase().replace('_', '-'),
                    Placeholder.unparsed("player", member.name()), Placeholder.unparsed("role", role.name())));
            plugin.getLogger().info("Role of " + member.name() + " @ " + context.shop().slug() + " -> " + role.name()
                    + " by " + player.getName() + ": " + result);
            showStaff(player, context);
        });
    }

    private void showRoles(Player player, Context context) {
        RoleRepository roles = plugin.roles();
        if (roles == null || !context.owner()) {
            return;
        }
        async(player, () -> roles.roles(context.shop().id()), list -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.roles", shopTags(context.shop())));
            for (int slot = 0; slot < Math.min(list.size(), LIST_SLOTS); slot++) {
                ShopRole role = list.get(slot);
                gui.set(slot, Icons.decorate(roleIcon(role), messages, "panel.roles.role",
                                List.of("panel.roles.members-line", "panel.roles.permissions-line", "panel.roles.edit-hint"),
                                roleTags(role, messages)),
                        (p, click) -> showRole(p, context, role));
            }
            gui.set(menu.slot("roles.roles-new", 53), Icons.decorate(menu.icon("roles.roles-new", Material.WRITABLE_BOOK), messages, "panel.roles.new", List.of("panel.roles.new-hint")),
                    (p, click) -> plugin.chatPrompt().askText(p, "prompt.role-name", 1, 24,
                            name -> changeRole(p, context, null, repo -> repo.create(context.shop().id(), p.getUniqueId(),
                                    p.hasPermission("cubezon.admin"), name))));
            gui.set(menu.slot("roles.back", BACK_SLOT), Icons.decorate(menu.icon("roles.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showStaff(p, context));
            gui.fill(menu.filler()).open(player);
        });
    }

    /** One role: a toggle per permission, rename, make default, delete. */
    private void showRole(Player player, Context context, ShopRole role) {
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
                                p.getUniqueId(), p.hasPermission("cubezon.admin"), changed));
                    });
        }
        gui.set(menu.slot("role.roles-rename", 28), Icons.decorate(menu.icon("role.roles-rename", Material.NAME_TAG), messages, "panel.roles.rename", List.of()),
                (p, click) -> plugin.chatPrompt().askText(p, "prompt.role-name", 1, 24,
                        name -> changeRole(p, context, null, repo -> repo.rename(context.shop().id(), role.id(),
                                p.getUniqueId(), p.hasPermission("cubezon.admin"), name))));
        if (!role.isDefault()) {
            gui.set(menu.slot("role.roles-make-default", 30), Icons.decorate(menu.icon("role.roles-make-default", Material.NETHER_STAR), messages, "panel.roles.make-default", List.of("panel.roles.make-default-hint")),
                    (p, click) -> changeRole(p, context, null, repo -> repo.makeDefault(context.shop().id(), role.id(),
                            p.getUniqueId(), p.hasPermission("cubezon.admin"))));
            gui.set(menu.slot("role.roles-delete", 34), Icons.decorate(menu.icon("role.roles-delete", Material.BARRIER), messages, "panel.roles.delete", List.of("panel.roles.delete-hint")),
                    (p, click) -> {
                        if (click != ClickType.SHIFT_LEFT && click != ClickType.SHIFT_RIGHT) {
                            p.sendMessage(messages.get("panel.roles.delete-confirm"));
                            return;
                        }
                        changeRole(p, context, null, repo -> repo.delete(context.shop().id(), role.id(),
                                p.getUniqueId(), p.hasPermission("cubezon.admin")));
                    });
        }
        gui.set(menu.slot("role.back", 27), Icons.decorate(menu.icon("role.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showRoles(p, context));
        gui.fill(menu.filler()).open(player);
    }

    private interface RoleChange {
        RoleRepository.Result apply(RoleRepository roles) throws SQLException;
    }

    /** Runs a role change and reopens the role (if {@code reopen} is given, refreshed) or the role list. */
    private void changeRole(Player player, Context context, ShopRole reopen, RoleChange change) {
        RoleRepository roles = plugin.roles();
        if (roles == null) {
            return;
        }
        async(player, () -> {
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

    private void showListings(Player player, Context context) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        async(player, () -> panel.listings(context.shop().id(), LIST_SLOTS), listings -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.listings", shopTags(context.shop())));
            for (int slot = 0; slot < listings.size(); slot++) {
                PanelListing listing = listings.get(slot);
                gui.set(slot, listingIcon(listing, messages, List.of("panel.listing.key", "panel.listing.unit",
                                "panel.listing.stock", "panel.listing.mode", "panel.listing.open")),
                        (p, click) -> showListing(p, context, listing));
            }
            if (listings.isEmpty()) {
                gui.set(menu.slot("listings.listings-empty", 22), Icons.decorate(menu.icon("listings.listings-empty", Material.PAPER), messages, "panel.listings.empty", List.of()));
            }
            if (context.can(ShopPermission.PRODUCTS_MANAGE)) {
                gui.set(menu.slot("listings.listings-new", 53), Icons.decorate(menu.icon("listings.listings-new", Material.WRITABLE_BOOK), messages, "panel.listings.new", List.of("panel.listings.new-hint")),
                        (p, click) -> createProduct(p, context));
            }
            back(gui, context);
            gui.fill(menu.filler()).open(player);
        });
    }

    private void showListing(Player player, Context context, PanelListing listing) {
        Messages messages = plugin.messages();
        TagResolver tags = listingTags(listing);
        Gui gui = new Gui(plugin.getServer(), 3, messages.plain("panel.listing.title", tags));

        gui.set(menu.slot("listing.product", 4), listingIcon(listing, messages, List.of("panel.listing.key", "panel.listing.unit", "panel.listing.stock")));
        if (context.can(ShopPermission.STOCK_DEPOSIT)) {
            gui.set(menu.slot("listing.listing-deposit", 10), Icons.decorate(menu.icon("listing.listing-deposit", Material.HOPPER), messages, "panel.listing.deposit", List.of("panel.listing.deposit-hint"), tags),
                    (p, click) -> plugin.depositController().openDeposit(p, depositable(context, listing)));
        }
        if (context.can(ShopPermission.STOCK_WITHDRAW)) {
            gui.set(menu.slot("listing.listing-withdraw", 11), Icons.decorate(menu.icon("listing.listing-withdraw", Material.DROPPER), messages, "panel.listing.withdraw", List.of("panel.listing.withdraw-hint"), tags),
                    (p, click) -> {
                        if (!isRight(click)) {
                            withdraw(p, context, listing, 1);
                        } else if (listing.available() < 1) {
                            p.sendMessage(messages.get("panel.listing.nothing-to-withdraw"));
                        } else {
                            plugin.chatPrompt().askAmount(p, "prompt.withdraw", listing.available(),
                                    amount -> withdraw(p, context, listing, amount));
                        }
                    });
        }
        if (context.can(ShopPermission.PRODUCTS_MANAGE)) {
            gui.set(menu.slot("listing.sample-mode", 12), Icons.decorate(listing.exact()
                            ? menu.icon("listing.sample-exact", Material.ENCHANTED_BOOK)
                            : menu.icon("listing.sample-type", Material.BOOK), messages, "panel.listing.sample",
                            List.of("panel.listing.mode", "panel.listing.sample-hint"), tags),
                    (p, click) -> setSample(p, context, listing, !isRight(click)));
            gui.set(menu.slot("listing.listing-rename", 14), Icons.decorate(menu.icon("listing.listing-rename", Material.NAME_TAG), messages, "panel.listing.rename", List.of("panel.listing.rename-hint"), tags),
                    (p, click) -> plugin.chatPrompt().askText(p, "prompt.product-title", titleMin(), titleMax(),
                            title -> editProduct(p, context, listing, "panel.listing.renamed", panel -> panel.setTitle(
                                    listing.id(), context.shop().id(), p.getUniqueId(), p.hasPermission("cubezon.admin"), title))));
            gui.set(menu.slot("listing.listing-price-button", 15), Icons.decorate(menu.icon("listing.listing-price-button", Material.GOLD_NUGGET), messages, "panel.listing.price-button", List.of("panel.listing.price-hint"), tags),
                    (p, click) -> plugin.chatPrompt().askPrice(p, "prompt.product-price",
                            price -> editProduct(p, context, listing, "panel.listing.price-changed", panel -> panel.setPrice(
                                    listing.id(), context.shop().id(), p.getUniqueId(), p.hasPermission("cubezon.admin"), price))));
            boolean active = "ACTIVE".equals(listing.status());
            gui.set(menu.slot("listing.status", 16), Icons.decorate(active ? menu.icon("listing.status-active", Material.LIME_DYE)
                            : menu.icon("listing.status-paused", Material.GRAY_DYE), messages,
                            active ? "panel.listing.pause" : "panel.listing.activate", List.of("panel.listing.status-line"), tags),
                    (p, click) -> editProduct(p, context, listing, active ? "panel.listing.paused" : "panel.listing.activated",
                            panel -> panel.setActive(listing.id(), context.shop().id(), p.getUniqueId(),
                                    p.hasPermission("cubezon.admin"), !active)));
            gui.set(menu.slot("listing.listing-remove", 26), Icons.decorate(menu.icon("listing.listing-remove", Material.BARRIER), messages, "panel.listing.remove", List.of("panel.listing.remove-hint"), tags),
                    (p, click) -> {
                        if (click != ClickType.SHIFT_LEFT && click != ClickType.SHIFT_RIGHT) {
                            p.sendMessage(messages.get("panel.listing.remove-confirm"));
                            return;
                        }
                        editProduct(p, context, listing, "panel.listing.removed", panel -> panel.removeListing(
                                listing.id(), context.shop().id(), p.getUniqueId(), p.hasPermission("cubezon.admin")));
                    });
        }
        if (listing.exact() && listing.sample() != null) {
            gui.set(menu.slot("listing.sample-preview", 8), sampleIcon(listing, messages));
        }
        gui.set(menu.slot("listing.back", 22), Icons.decorate(menu.icon("listing.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showListings(p, context));
        gui.fill(menu.filler()).open(player);
    }

    /**
     * New product from the item in hand: its key and base come from the item; name, items per unit
     * and price are asked in chat, one after the other.
     */
    private void createProduct(Player player, Context context) {
        Messages messages = plugin.messages();
        ItemStack hand = player.getInventory().getItemInMainHand();
        if (hand.isEmpty()) {
            player.sendMessage(messages.get("panel.listings.new-empty-hand"));
            return;
        }
        ItemKey key = plugin.itemIdentity().identify(hand);
        int maxUnit = Math.min(99, hand.getMaxStackSize());
        ChatPrompt prompt = plugin.chatPrompt();
        prompt.askText(player, "prompt.product-title", titleMin(), titleMax(), title ->
                prompt.askAmount(player, "prompt.product-unit", maxUnit, unit ->
                        prompt.askPrice(player, "prompt.product-price", price -> saveProduct(player, context, key, title, unit, price))));
    }

    private void saveProduct(Player player, Context context, ItemKey key, String title, int unit, BigDecimal price) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = player.hasPermission("cubezon.admin");
        async(player, () -> panel.createListing(context.shop().id(), playerId, admin, title, key.baseMaterial(), key.key(),
                unit, price), created -> {
            Messages messages = plugin.messages();
            if (created.isEmpty()) {
                player.sendMessage(messages.get("panel.listings.new-denied"));
                return;
            }
            player.sendMessage(messages.get("panel.listings.created", Placeholder.unparsed("title", title),
                    Placeholder.unparsed("key", key.key()), Placeholder.unparsed("amount", String.valueOf(unit))));
            plugin.getLogger().info("Product " + created.get() + " (" + key.key() + ") created in " + context.shop().slug()
                    + " by " + player.getName());
        });
    }

    private interface ProductChange {
        boolean apply(ShopPanelRepository panel) throws SQLException;
    }

    /** Owner-only product edits: the SQL checks the owner again; false = not allowed or not possible now. */
    private void editProduct(Player player, Context context, PanelListing listing, String doneKey, ProductChange change) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        async(player, () -> change.apply(panel), changed -> {
            Messages messages = plugin.messages();
            player.sendMessage(messages.get(changed ? doneKey : "panel.listing.change-failed",
                    Placeholder.unparsed("title", listing.title())));
            showListings(player, context);
        });
    }

    /** Owner only. Units are marked RETURNED in the database before they are handed over. */
    private void withdraw(Player player, Context context, PanelListing listing, int count) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = player.hasPermission("cubezon.admin");
        async(player, () -> panel.withdraw(listing.id(), context.shop().id(), playerId, admin, count), units -> {
            Messages messages = plugin.messages();
            if (units.isEmpty()) {
                player.sendMessage(messages.get("panel.listing.nothing-to-withdraw"));
            } else {
                for (byte[] unit : units) {
                    try {
                        SpecialItemShop.giveOrDrop(player, ItemStack.deserializeBytes(unit));
                    } catch (RuntimeException e) {
                        plugin.getLogger().log(Level.SEVERE, "Withdrawn unit of listing " + listing.id()
                                + " is unreadable; data (Base64): " + Base64.getEncoder().encodeToString(unit), e);
                    }
                }
                player.sendMessage(messages.get("panel.listing.withdrawn",
                        Placeholder.unparsed("units", String.valueOf(units.size())), Placeholder.unparsed("title", listing.title())));
            }
            showListings(player, context);
        });
    }

    /** Left click: the item in hand becomes the exact sample. Right click: back to matching by key. */
    private void setSample(Player player, Context context, PanelListing listing, boolean fromHand) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        Messages messages = plugin.messages();
        byte[] sample = null;
        if (fromHand) {
            ItemStack hand = player.getInventory().getItemInMainHand();
            if (hand.isEmpty()) {
                player.sendMessage(messages.get("item.empty-hand"));
                return;
            }
            String key = plugin.itemIdentity().identify(hand).key();
            if (!key.equals(listing.itemKey())) {
                player.sendMessage(messages.get("panel.listing.sample-wrong-item",
                        Placeholder.unparsed("key", key), Placeholder.unparsed("expected", listing.itemKey())));
                return;
            }
            sample = hand.asOne().serializeAsBytes();
        }
        byte[] newSample = sample;
        UUID playerId = player.getUniqueId();
        boolean admin = player.hasPermission("cubezon.admin");
        async(player, () -> panel.setSample(listing.id(), context.shop().id(), playerId, admin, newSample), changed -> {
            player.sendMessage(messages.get(!changed ? "computer.failed"
                    : newSample == null ? "panel.listing.sample-cleared" : "panel.listing.sample-set",
                    Placeholder.unparsed("title", listing.title())));
            showListings(player, context);
        });
    }

    private void showStorage(Player player, Context context) {
        Messages messages = plugin.messages();
        TagResolver tags = shopTags(context.shop());
        Gui gui = new Gui(plugin.getServer(), 4, messages.plain("panel.titles.storage", tags));
        gui.set(menu.slot("storage.storage-info", 4), Icons.decorate(menu.icon("storage.storage-info", Material.BARREL), messages, "panel.storage.info",
                List.of("panel.storage.used", "panel.storage.blocks", "panel.shop.zone"), tags));
        // Storage types on sale: left click buys one, right click buys eight.
        int slot = 9;
        for (StorageType type : plugin.storageController().types()) {
            if (!type.buyable() || slot > 26 || !context.can(ShopPermission.STORAGE_BUY)) {
                continue;
            }
            gui.set(slot++, Icons.of(type.material(), messages, "panel.storage.type",
                            List.of("panel.storage.type-capacity", "panel.storage.type-price", "panel.storage.type-hint"),
                            plugin.storageController().typeTags(type)),
                    (p, click) -> {
                        if (isRight(click)) {
                            plugin.chatPrompt().askAmount(p, "prompt.buy", maxPurchase(),
                                    amount -> plugin.storageController().buy(p, type.id(), amount));
                        } else {
                            plugin.storageController().buy(p, type.id(), 1);
                        }
                    });
        }
        if (context.can(ShopPermission.STORAGE_BUY)) gui.set(menu.slot("storage.storage-buy-computer", 31), Icons.decorate(menu.icon("storage.storage-buy-computer", Material.CRAFTER), messages, "panel.storage.buy-computer", List.of("panel.storage.buy-hint")),
                (p, click) -> {
                    if (isRight(click)) {
                        plugin.chatPrompt().askAmount(p, "prompt.buy", maxPurchase(),
                                amount -> plugin.roleplayController().buy(p, amount));
                    } else {
                        plugin.roleplayController().buy(p, 1);
                    }
                });
        gui.set(menu.slot("storage.back", 27), Icons.decorate(menu.icon("storage.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> open(p, context.computer()));
        gui.fill(menu.filler()).open(player);
    }

    private void back(Gui gui, Context context) {
        gui.set(menu.slot("common.back", BACK_SLOT), Icons.decorate(menu.icon("common.back", Material.ARROW), plugin.messages(), "panel.back", List.of()),
                (p, click) -> open(p, context.computer()));
    }

    /** config.yml settings.product-title.min/max, inside what the database accepts (3-60). */
    private int titleMin() {
        return Math.clamp(plugin.getConfig().getInt("settings.product-title.min", 3), 3, 60);
    }

    private int titleMax() {
        return Math.clamp(plugin.getConfig().getInt("settings.product-title.max", 60), titleMin(), 60);
    }

    /** config.yml settings.max-purchase-amount (1-256). */
    private int maxPurchase() {
        return Math.clamp(plugin.getConfig().getInt("settings.max-purchase-amount", StorageController.MAX_AMOUNT), 1,
                StorageController.MAX_AMOUNT);
    }

    static String shorten(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max - 1).stripTrailing() + "…";
    }

    private static boolean isRight(ClickType click) {
        return click == ClickType.RIGHT || click == ClickType.SHIFT_RIGHT;
    }

    private DepositableListing depositable(Context context, PanelListing listing) {
        return new DepositableListing(listing.id(), listing.title(), context.shop().name(), listing.itemKey(),
                listing.material(), listing.unitAmount(), listing.unitPrice(), listing.available(),
                listing.matchMode(), listing.sample());
    }

    private ItemStack roleIcon(ShopRole role) {
        return role.isDefault() ? menu.icon("roles.role-default", Material.NETHER_STAR) : menu.icon("roles.role", Material.NAME_TAG);
    }

    private ItemStack listingIcon(PanelListing listing, Messages messages, List<String> lore) {
        Material material = Material.matchMaterial(listing.material());
        ItemStack icon = new ItemStack(material != null && material.isItem() ? material : Material.PAPER);
        return Icons.decorate(icon, messages, "panel.listing.name", lore, listingTags(listing));
    }

    private ItemStack sampleIcon(PanelListing listing, Messages messages) {
        try {
            ItemStack sample = ItemStack.deserializeBytes(listing.sample());
            sample.editMeta(meta -> {
                List<Component> lore = meta.hasLore() ? new ArrayList<>(meta.lore()) : new ArrayList<>();
                lore.add(messages.plain("panel.listing.sample-label").decoration(TextDecoration.ITALIC, false));
                meta.lore(lore);
            });
            return sample;
        } catch (RuntimeException e) {
            return Icons.decorate(menu.icon("listing.sample-broken", Material.STRUCTURE_VOID), messages,
                    "panel.listing.sample-broken", List.of());
        }
    }

    private TagResolver listingTags(PanelListing listing) {
        var economy = plugin.economy();
        String price = economy == null ? listing.unitPrice().toPlainString() : economy.format(listing.unitPrice().doubleValue());
        return TagResolver.resolver(
                Placeholder.unparsed("title", listing.title()),
                Placeholder.unparsed("key", listing.itemKey()),
                Placeholder.unparsed("amount", String.valueOf(listing.unitAmount())),
                Placeholder.unparsed("price", price),
                Placeholder.unparsed("available", String.valueOf(listing.available())),
                Placeholder.unparsed("reserved", String.valueOf(listing.reserved())),
                Placeholder.component("mode", plugin.messages().plain(listing.exact() ? "panel.listing.mode-exact" : "panel.listing.mode-key")),
                Placeholder.unparsed("status", listing.status()));
    }

    private TagResolver shopTags(ShopInfo shop) {
        Messages messages = plugin.messages();
        return TagResolver.resolver(
                Placeholder.unparsed("shop", shop.name()),
                Placeholder.unparsed("shop_short", shorten(shop.name(), Math.clamp(plugin.getConfig().getInt("settings.menu-title-name-length", 22), 8, 40))),
                Placeholder.unparsed("slug", shop.slug()),
                Placeholder.unparsed("owner", shop.ownerName()),
                Placeholder.unparsed("status", shop.status()),
                Placeholder.component("zone", messages.plain(shop.hasZone() ? "panel.shop.zone-yes" : "panel.shop.zone-no")),
                Placeholder.unparsed("mode", plugin.orderMode().key()),
                Placeholder.unparsed("used", String.valueOf(shop.usedUnits())),
                Placeholder.unparsed("capacity", String.valueOf(shop.capacityUnits())),
                Placeholder.unparsed("blocks", String.valueOf(shop.storageBlocks())),
                Placeholder.unparsed("members", String.valueOf(shop.members())));
    }

    /** Loads off the main thread, then continues on it (only if the player is still online). */
    private <T> void async(Player player, Load<T> load, Consumer<T> then) {
        plugin.dbExecutor().execute(() -> {
            T value;
            try {
                value = load.load();
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Computer panel query failed", e);
                player.sendMessage(plugin.messages().get("computer.failed"));
                return;
            }
            if (plugin.isEnabled()) {
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (player.isOnline()) {
                        then.accept(value);
                    }
                });
            }
        });
    }
}
