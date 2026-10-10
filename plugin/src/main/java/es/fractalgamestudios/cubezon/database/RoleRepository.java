package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.roles.ShopRole;

import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * public.shop_roles and the permission checks. Role definitions are changed only by the owner (or an
 * admin); assigning roles needs staff.manage, and only the owner can hand out staff.manage.
 */
public final class RoleRepository {

    public enum Result { OK, NOT_ALLOWED, NOT_FOUND, DUPLICATE_NAME, LIMIT, DEFAULT_ROLE }

    private static final String CHECK_VIOLATION = "23514";
    private static final String UNIQUE_VIOLATION = "23505";

    private static final String PERMISSIONS_OF = "select public.shop_permissions_of(?, ?)";

    private static final String IS_OWNER = "select owner_uuid = ? from public.shops where id = ?";

    private static final String FIND_ROLES = """
            select r.id, r.name, r.position, r.permissions, r.is_default,
                   (select count(*) from public.shop_members m where m.role_id = r.id) as members
            from public.shop_roles r where r.shop_id = ?
            order by r.position, r.name
            """;

    private static final String CREATE = """
            insert into public.shop_roles (shop_id, name, position)
            values (?, ?, coalesce((select max(position) + 1 from public.shop_roles where shop_id = ?), 1))
            """;

    private static final String RENAME = "update public.shop_roles set name = ? where id = ? and shop_id = ?";

    private static final String SET_PERMISSIONS = "update public.shop_roles set permissions = ? where id = ? and shop_id = ?";

    private static final String CLEAR_DEFAULT = "update public.shop_roles set is_default = false where shop_id = ? and is_default";

    private static final String SET_DEFAULT = "update public.shop_roles set is_default = true where id = ? and shop_id = ?";

    private static final String DELETE = "delete from public.shop_roles where id = ? and shop_id = ?";

    private static final String ROLE_PERMISSIONS = "select permissions from public.shop_roles where id = ? and shop_id = ?";

    private static final String MEMBER_PERMISSIONS = """
            select r.permissions from public.shop_members m
            left join public.shop_roles r on r.id = m.role_id
            where m.shop_id = ? and m.player_uuid = ?
            """;

    private static final String ASSIGN = "update public.shop_members set role_id = ? where shop_id = ? and player_uuid = ?";

    private final Database database;

    public RoleRepository(Database database) {
        this.database = database;
    }

    /** Owner: all; employee: their role's; anybody else: none. */
    public Set<ShopPermission> permissionsOf(UUID shopId, UUID playerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(PERMISSIONS_OF)) {
            statement.setObject(1, shopId);
            statement.setObject(2, playerId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() ? toPermissions(row.getArray(1)) : EnumSet.noneOf(ShopPermission.class);
            }
        }
    }

    public List<ShopRole> roles(UUID shopId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ROLES)) {
            statement.setObject(1, shopId);
            List<ShopRole> roles = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    roles.add(new ShopRole(rows.getObject("id", UUID.class), rows.getString("name"), rows.getInt("position"),
                            toPermissions(rows.getArray("permissions")), rows.getBoolean("is_default"), rows.getInt("members")));
                }
            }
            return roles;
        }
    }

    public Result create(UUID shopId, UUID requesterId, boolean admin, String name) throws SQLException {
        return asOwner(shopId, requesterId, admin, connection -> {
            try (PreparedStatement statement = connection.prepareStatement(CREATE)) {
                statement.setObject(1, shopId);
                statement.setString(2, name);
                statement.setObject(3, shopId);
                statement.executeUpdate();
                return Result.OK;
            }
        });
    }

    public Result rename(UUID shopId, UUID roleId, UUID requesterId, boolean admin, String name) throws SQLException {
        return asOwner(shopId, requesterId, admin, connection -> {
            try (PreparedStatement statement = connection.prepareStatement(RENAME)) {
                statement.setString(1, name);
                statement.setObject(2, roleId);
                statement.setObject(3, shopId);
                return statement.executeUpdate() > 0 ? Result.OK : Result.NOT_FOUND;
            }
        });
    }

    public Result setPermissions(UUID shopId, UUID roleId, UUID requesterId, boolean admin,
                                 Collection<ShopPermission> permissions) throws SQLException {
        return asOwner(shopId, requesterId, admin, connection -> {
            try (PreparedStatement statement = connection.prepareStatement(SET_PERMISSIONS)) {
                statement.setArray(1, connection.createArrayOf("text",
                        permissions.stream().map(ShopPermission::key).toArray(String[]::new)));
                statement.setObject(2, roleId);
                statement.setObject(3, shopId);
                return statement.executeUpdate() > 0 ? Result.OK : Result.NOT_FOUND;
            }
        });
    }

    /** The role new hires get. Two updates in one transaction: the old default off, the new one on. */
    public Result makeDefault(UUID shopId, UUID roleId, UUID requesterId, boolean admin) throws SQLException {
        return asOwner(shopId, requesterId, admin, connection -> {
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement clear = connection.prepareStatement(CLEAR_DEFAULT)) {
                    clear.setObject(1, shopId);
                    clear.executeUpdate();
                }
                int updated;
                try (PreparedStatement set = connection.prepareStatement(SET_DEFAULT)) {
                    set.setObject(1, roleId);
                    set.setObject(2, shopId);
                    updated = set.executeUpdate();
                }
                if (updated == 0) {
                    connection.rollback();
                    return Result.NOT_FOUND;
                }
                connection.commit();
                return Result.OK;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        });
    }

    /** Its employees move to the default role (database trigger); the default role cannot be deleted. */
    public Result delete(UUID shopId, UUID roleId, UUID requesterId, boolean admin) throws SQLException {
        return asOwner(shopId, requesterId, admin, connection -> {
            try (PreparedStatement statement = connection.prepareStatement(DELETE)) {
                statement.setObject(1, roleId);
                statement.setObject(2, shopId);
                return statement.executeUpdate() > 0 ? Result.OK : Result.NOT_FOUND;
            }
        });
    }

    /**
     * Gives an employee a role. Needs staff.manage; only the owner (or an admin) may give a role that
     * includes staff.manage, or change the role of someone who has it, so nobody can promote themself.
     */
    public Result assign(UUID shopId, UUID memberId, UUID roleId, UUID requesterId, boolean admin) throws SQLException {
        try (Connection connection = database.connection()) {
            boolean owner = admin || isOwner(connection, shopId, requesterId);
            if (!owner) {
                Set<ShopPermission> mine = permissionsOf(shopId, requesterId);
                Set<ShopPermission> target = rolePermissions(connection, shopId, roleId);
                Set<ShopPermission> current = memberPermissions(connection, shopId, memberId);
                if (!mine.contains(ShopPermission.STAFF_MANAGE)
                        || target.contains(ShopPermission.STAFF_MANAGE)
                        || current.contains(ShopPermission.STAFF_MANAGE)) {
                    return Result.NOT_ALLOWED;
                }
            }
            try (PreparedStatement statement = connection.prepareStatement(ASSIGN)) {
                statement.setObject(1, roleId);
                statement.setObject(2, shopId);
                statement.setObject(3, memberId);
                return statement.executeUpdate() > 0 ? Result.OK : Result.NOT_FOUND;
            }
        } catch (SQLException e) {
            if (CHECK_VIOLATION.equals(e.getSQLState())) {
                return Result.NOT_FOUND;
            }
            throw e;
        }
    }

    private interface OwnerAction {
        Result run(Connection connection) throws SQLException;
    }

    private Result asOwner(UUID shopId, UUID requesterId, boolean admin, OwnerAction action) throws SQLException {
        try (Connection connection = database.connection()) {
            if (!admin && !isOwner(connection, shopId, requesterId)) {
                return Result.NOT_ALLOWED;
            }
            return action.run(connection);
        } catch (SQLException e) {
            String message = String.valueOf(e.getMessage());
            if (UNIQUE_VIOLATION.equals(e.getSQLState())) {
                return Result.DUPLICATE_NAME;
            }
            if (CHECK_VIOLATION.equals(e.getSQLState()) && message.contains("SHOP_ROLES_EXCEEDED")) {
                return Result.LIMIT;
            }
            if (CHECK_VIOLATION.equals(e.getSQLState()) && message.contains("DEFAULT_ROLE_CANNOT_BE_DELETED")) {
                return Result.DEFAULT_ROLE;
            }
            throw e;
        }
    }

    private static boolean isOwner(Connection connection, UUID shopId, UUID playerId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(IS_OWNER)) {
            statement.setObject(1, playerId);
            statement.setObject(2, shopId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() && row.getBoolean(1);
            }
        }
    }

    private static Set<ShopPermission> rolePermissions(Connection connection, UUID shopId, UUID roleId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(ROLE_PERMISSIONS)) {
            statement.setObject(1, roleId);
            statement.setObject(2, shopId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() ? toPermissions(row.getArray(1)) : EnumSet.noneOf(ShopPermission.class);
            }
        }
    }

    private static Set<ShopPermission> memberPermissions(Connection connection, UUID shopId, UUID memberId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(MEMBER_PERMISSIONS)) {
            statement.setObject(1, shopId);
            statement.setObject(2, memberId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() ? toPermissions(row.getArray(1)) : EnumSet.noneOf(ShopPermission.class);
            }
        }
    }

    private static Set<ShopPermission> toPermissions(Array array) throws SQLException {
        if (array == null) {
            return EnumSet.noneOf(ShopPermission.class);
        }
        return ShopPermission.fromKeys(Arrays.asList((String[]) array.getArray()));
    }
}
