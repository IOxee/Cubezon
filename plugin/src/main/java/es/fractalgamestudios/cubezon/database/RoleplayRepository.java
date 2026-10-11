package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.roleplay.ComputerBlock;
import es.fractalgamestudios.cubezon.roleplay.ComputerKind;
import es.fractalgamestudios.cubezon.roleplay.ShopOrderView;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Roleplay mode: company computers, shop employees and the order inbox of each shop. */
public final class RoleplayRepository {

    public enum MemberResult {
        ADDED, REMOVED, ALREADY, NOT_MEMBER, NOT_ALLOWED, SHOP_NOT_FOUND, PLAYER_NOT_FOUND, IS_OWNER, MEMBERSHIP_LIMIT
    }

    /** check_violation raised by the shop_members trigger when the player already works in too many shops. */
    static boolean isMembershipLimit(SQLException e) {
        return "23514".equals(e.getSQLState()) && e.getMessage() != null && e.getMessage().contains("SHOP_MEMBERSHIPS_EXCEEDED");
    }

    /** A shop resolved by slug, with whether the requester may manage its staff. */
    private record ShopAccess(UUID shopId, UUID ownerId, boolean canManage) {
    }

    private static final String PUBLISH_SETTING = """
            insert into public.plugin_settings (key, value, updated_at) values (?, ?, now())
            on conflict (key) do update set value = excluded.value, updated_at = now()
            """;

    private static final String FIND_COMPUTERS = """
            select c.id, c.shop_id, s.name as shop_name, c.world, c.x, c.y, c.z, c.kind
            from public.shop_computers c
            join public.shops s on s.id = c.shop_id
            """;

    private static final String INSERT_COMPUTER = """
            insert into public.shop_computers (shop_id, world, x, y, z, placed_by, kind)
            values (?, ?, ?, ?, ?, ?, ?)
            returning id
            """;

    private static final String DELETE_COMPUTER = "delete from public.shop_computers where id = ?";

    private static final String CAN_USE = """
            select s.owner_uuid = ?
                   or exists (select 1 from public.shop_members m where m.shop_id = s.id and m.player_uuid = ?)
            from public.shops s where s.id = ?
            """;

    /** Orders waiting for the shop (PENDING) and accepted ones still to deliver (PAID). */
    private static final String SHOP_ORDERS = """
            select o.id, o.status::text as status, o.processing_started_at is not null as processing,
                   o.quantity, o.total, o.created_at, o.paid_at,
                   l.title, l.material, o.buyer_uuid, p.name as buyer_name, k.id as locker_id,
                   coalesce(k.name, '') as locker_name, o.delivery_method,
                   case when b.id is null then null else b.world || ' ' || b.x || ' ' || b.y || ' ' || b.z end as mailbox_position,
                   o.mailbox_id
            from public.orders o
            join public.listings l on l.id = o.listing_id
            join public.players p on p.uuid = o.buyer_uuid
            left join public.lockers k on k.id = o.locker_id
            left join public.mailboxes b on b.id = o.mailbox_id
            where o.shop_id = ? and o.status in ('PENDING', 'PAID')
            order by o.status = 'PENDING' desc, o.created_at
            limit ?
            """;

    /** Current or previous slug: owners can rename their shop on the web. */
    private static final String FIND_SHOP_BY_SLUG = """
            select id, owner_uuid, public.shop_member_can(id, ?, 'staff.manage') as can_manage from public.shops
            where slug = ? or id = (select h.shop_id from public.shop_slug_history h where h.slug = ?)
            """;

    private static final String FIND_PLAYER_BY_NAME = "select uuid from public.players where lower(name) = lower(?)";

    private static final String ADD_MEMBER = """
            insert into public.shop_members (shop_id, player_uuid, added_by) values (?, ?, ?)
            on conflict do nothing
            """;

    private static final String REMOVE_MEMBER = "delete from public.shop_members where shop_id = ? and player_uuid = ?";

    private static final String LIST_MEMBERS = """
            select p.name from public.shop_members m join public.players p on p.uuid = m.player_uuid
            where m.shop_id = ? order by p.name
            """;

    private final Database database;

    public RoleplayRepository(Database database) {
        this.database = database;
    }

    /** Publishes a value for the web (e.g. orders_mode), readable with the publishable key. */
    public void publishSetting(String key, String value) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(PUBLISH_SETTING)) {
            statement.setString(1, key);
            statement.setString(2, value);
            statement.executeUpdate();
        }
    }

    public List<ComputerBlock> findComputers() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_COMPUTERS);
             ResultSet rows = statement.executeQuery()) {
            List<ComputerBlock> computers = new ArrayList<>();
            while (rows.next()) {
                computers.add(new ComputerBlock(rows.getObject("id", UUID.class), rows.getObject("shop_id", UUID.class),
                        rows.getString("shop_name"),
                        new BlockPosition(rows.getString("world"), rows.getInt("x"), rows.getInt("y"), rows.getInt("z")),
                        ComputerKind.parse(rows.getString("kind"))));
            }
            return computers;
        }
    }

    public ComputerBlock insertComputer(UUID shopId, String shopName, BlockPosition position, UUID placedBy,
                                        ComputerKind kind) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(INSERT_COMPUTER)) {
            statement.setObject(1, shopId);
            statement.setString(2, position.world());
            statement.setInt(3, position.x());
            statement.setInt(4, position.y());
            statement.setInt(5, position.z());
            statement.setObject(6, placedBy);
            statement.setString(7, kind.name());
            try (ResultSet row = statement.executeQuery()) {
                row.next();
                return new ComputerBlock(row.getObject("id", UUID.class), shopId, shopName, position, kind);
            }
        }
    }

    /** @return false if it was already gone */
    public boolean deleteComputer(UUID computerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(DELETE_COMPUTER)) {
            statement.setObject(1, computerId);
            return statement.executeUpdate() > 0;
        }
    }

    /** The permission check of the database (owner: everything; employee: their role). */
    public boolean can(UUID shopId, UUID playerId, String permission) throws SQLException {
        try (Connection connection = database.connection()) {
            return can(connection, shopId, playerId, permission);
        }
    }

    private static boolean can(Connection connection, UUID shopId, UUID playerId, String permission) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("select public.shop_member_can(?, ?, ?)")) {
            statement.setObject(1, shopId);
            statement.setObject(2, playerId);
            statement.setString(3, permission);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() && row.getBoolean(1);
            }
        }
    }

    /** Owner or employee of the shop. */
    public boolean canUse(UUID shopId, UUID playerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(CAN_USE)) {
            statement.setObject(1, playerId);
            statement.setObject(2, playerId);
            statement.setObject(3, shopId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() && row.getBoolean(1);
            }
        }
    }

    public List<ShopOrderView> findShopOrders(UUID shopId, int limit) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(SHOP_ORDERS)) {
            statement.setObject(1, shopId);
            statement.setInt(2, limit);
            List<ShopOrderView> orders = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    orders.add(new ShopOrderView(
                            rows.getObject("id", UUID.class),
                            rows.getString("status"),
                            rows.getBoolean("processing"),
                            rows.getString("title"),
                            rows.getString("material"),
                            rows.getObject("buyer_uuid", UUID.class),
                            rows.getString("buyer_name"),
                            rows.getInt("quantity"),
                            rows.getBigDecimal("total"),
                            rows.getObject("locker_id", UUID.class),
                            rows.getString("locker_name"),
                            rows.getObject("created_at", OffsetDateTime.class),
                            rows.getObject("paid_at", OffsetDateTime.class),
                            rows.getString("delivery_method"),
                            rows.getString("mailbox_position"),
                            rows.getObject("mailbox_id", UUID.class)));
                }
            }
            return orders;
        }
    }

    /** The owner, an admin or an employee with staff.manage manages employees. */
    public MemberResult addMember(String slug, UUID requesterId, boolean admin, String playerName) throws SQLException {
        try (Connection connection = database.connection()) {
            ShopAccess shop = findShop(connection, slug, requesterId).orElse(null);
            MemberResult denied = checkAccess(shop, requesterId, admin);
            if (denied != null) {
                return denied;
            }
            UUID playerId = findPlayer(connection, playerName).orElse(null);
            if (playerId == null) {
                return MemberResult.PLAYER_NOT_FOUND;
            }
            if (playerId.equals(shop.ownerId())) {
                return MemberResult.IS_OWNER;
            }
            try (PreparedStatement insert = connection.prepareStatement(ADD_MEMBER)) {
                insert.setObject(1, shop.shopId());
                insert.setObject(2, playerId);
                insert.setObject(3, requesterId);
                return insert.executeUpdate() > 0 ? MemberResult.ADDED : MemberResult.ALREADY;
            } catch (SQLException e) {
                if (isMembershipLimit(e)) {
                    return MemberResult.MEMBERSHIP_LIMIT;
                }
                throw e;
            }
        }
    }

    public MemberResult removeMember(String slug, UUID requesterId, boolean admin, String playerName) throws SQLException {
        try (Connection connection = database.connection()) {
            ShopAccess shop = findShop(connection, slug, requesterId).orElse(null);
            MemberResult denied = checkAccess(shop, requesterId, admin);
            if (denied != null) {
                return denied;
            }
            UUID playerId = findPlayer(connection, playerName).orElse(null);
            if (playerId == null) {
                return MemberResult.PLAYER_NOT_FOUND;
            }
            // Only the owner (or an admin) fires someone who can manage staff.
            if (!admin && !shop.ownerId().equals(requesterId) && can(connection, shop.shopId(), playerId, "staff.manage")) {
                return MemberResult.NOT_ALLOWED;
            }
            try (PreparedStatement delete = connection.prepareStatement(REMOVE_MEMBER)) {
                delete.setObject(1, shop.shopId());
                delete.setObject(2, playerId);
                return delete.executeUpdate() > 0 ? MemberResult.REMOVED : MemberResult.NOT_MEMBER;
            }
        }
    }

    /** Employee names, or empty if the requester may not see them. */
    public Optional<List<String>> listMembers(String slug, UUID requesterId, boolean admin) throws SQLException {
        try (Connection connection = database.connection()) {
            ShopAccess shop = findShop(connection, slug, requesterId).orElse(null);
            if (checkAccess(shop, requesterId, admin) != null) {
                return Optional.empty();
            }
            try (PreparedStatement list = connection.prepareStatement(LIST_MEMBERS)) {
                list.setObject(1, shop.shopId());
                List<String> names = new ArrayList<>();
                try (ResultSet rows = list.executeQuery()) {
                    while (rows.next()) {
                        names.add(rows.getString(1));
                    }
                }
                return Optional.of(names);
            }
        }
    }

    private static MemberResult checkAccess(ShopAccess shop, UUID requesterId, boolean admin) {
        if (shop == null) {
            return MemberResult.SHOP_NOT_FOUND;
        }
        return admin || shop.canManage() ? null : MemberResult.NOT_ALLOWED;
    }

    private static Optional<ShopAccess> findShop(Connection connection, String slug, UUID requesterId) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement(FIND_SHOP_BY_SLUG)) {
            select.setObject(1, requesterId);
            select.setString(2, slug);
            select.setString(3, slug);
            try (ResultSet row = select.executeQuery()) {
                return row.next()
                        ? Optional.of(new ShopAccess(row.getObject("id", UUID.class), row.getObject("owner_uuid", UUID.class),
                        row.getBoolean("can_manage")))
                        : Optional.empty();
            }
        }
    }

    private static Optional<UUID> findPlayer(Connection connection, String name) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement(FIND_PLAYER_BY_NAME)) {
            select.setString(1, name);
            try (ResultSet row = select.executeQuery()) {
                return row.next() ? Optional.of(row.getObject("uuid", UUID.class)) : Optional.empty();
            }
        }
    }
}
