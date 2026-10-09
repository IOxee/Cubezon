package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.locker.Locker;
import org.jetbrains.annotations.Nullable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** public.lockers. The plugin creates and removes them; the web only toggles `active`. */
public final class LockerRepository {

    public enum RemoveResult { REMOVED, MOVED, DEACTIVATED, NOT_FOUND, TARGET_NOT_FOUND, TARGET_INACTIVE, SAME_LOCKER }

    /** {@code orders} is how many orders the locker had (moved ones, for MOVED). */
    public record RemoveOutcome(RemoveResult result, int orders) {
    }

    private static final String UNIQUE_VIOLATION = "23505";

    private static final String FIND_ALL = "select id, name, world, x, y, z, active from public.lockers";

    private static final String INSERT = """
            insert into public.lockers (name, world, x, y, z) values (?, ?, ?, ?, ?)
            returning id, name, world, x, y, z, active
            """;

    private static final String LOCK_BY_NAME =
            "select id, active from public.lockers where lower(name) = lower(?) limit 1 for update";

    private static final String COUNT_ORDERS = "select count(*) from public.orders where locker_id = ?";

    private static final String MOVE_ORDERS = "update public.orders set locker_id = ? where locker_id = ?";

    private static final String DELETE = "delete from public.lockers where id = ?";

    private static final String DEACTIVATE = "update public.lockers set active = false where id = ?";

    private final Database database;

    public LockerRepository(Database database) {
        this.database = database;
    }

    public List<Locker> findAll() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ALL);
             ResultSet rows = statement.executeQuery()) {
            List<Locker> lockers = new ArrayList<>();
            while (rows.next()) {
                lockers.add(read(rows));
            }
            return lockers;
        }
    }

    /** @return empty if the name or the block is already used by another locker */
    public Optional<Locker> create(String name, BlockPosition position) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(INSERT)) {
            statement.setString(1, name);
            statement.setString(2, position.world());
            statement.setInt(3, position.x());
            statement.setInt(4, position.y());
            statement.setInt(5, position.z());
            try (ResultSet row = statement.executeQuery()) {
                row.next();
                return Optional.of(read(row));
            }
        } catch (SQLException e) {
            if (UNIQUE_VIOLATION.equals(e.getSQLState())) {
                return Optional.empty();
            }
            throw e;
        }
    }

    /**
     * Deletes the locker. Orders keep pointing at their locker, so a locker with orders is only
     * deactivated, unless {@code moveTo} names another active locker: then its orders (open and
     * finished) move there and the locker is deleted, all in one transaction.
     */
    public RemoveOutcome remove(String name, @Nullable String moveTo) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                RemoveOutcome outcome = remove(connection, name, moveTo);
                connection.commit();
                return outcome;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    private static RemoveOutcome remove(Connection connection, String name, @Nullable String moveTo) throws SQLException {
        UUID lockerId = lockByName(connection, name).map(LockedLocker::id).orElse(null);
        if (lockerId == null) {
            return new RemoveOutcome(RemoveResult.NOT_FOUND, 0);
        }
        int orders;
        try (PreparedStatement count = connection.prepareStatement(COUNT_ORDERS)) {
            count.setObject(1, lockerId);
            try (ResultSet row = count.executeQuery()) {
                row.next();
                orders = row.getInt(1);
            }
        }
        if (orders > 0 && moveTo == null) {
            execute(connection, DEACTIVATE, lockerId);
            return new RemoveOutcome(RemoveResult.DEACTIVATED, orders);
        }
        if (orders > 0) {
            LockedLocker target = lockByName(connection, moveTo).orElse(null);
            if (target == null) {
                return new RemoveOutcome(RemoveResult.TARGET_NOT_FOUND, orders);
            }
            if (target.id().equals(lockerId)) {
                return new RemoveOutcome(RemoveResult.SAME_LOCKER, orders);
            }
            if (!target.active()) {
                return new RemoveOutcome(RemoveResult.TARGET_INACTIVE, orders);
            }
            try (PreparedStatement move = connection.prepareStatement(MOVE_ORDERS)) {
                move.setObject(1, target.id());
                move.setObject(2, lockerId);
                move.executeUpdate();
            }
        }
        execute(connection, DELETE, lockerId);
        return new RemoveOutcome(orders > 0 ? RemoveResult.MOVED : RemoveResult.REMOVED, orders);
    }

    private record LockedLocker(UUID id, boolean active) {
    }

    private static Optional<LockedLocker> lockByName(Connection connection, String name) throws SQLException {
        try (PreparedStatement select = connection.prepareStatement(LOCK_BY_NAME)) {
            select.setString(1, name);
            try (ResultSet row = select.executeQuery()) {
                return row.next()
                        ? Optional.of(new LockedLocker(row.getObject("id", UUID.class), row.getBoolean("active")))
                        : Optional.empty();
            }
        }
    }

    private static void execute(Connection connection, String sql, UUID id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            statement.executeUpdate();
        }
    }

    private static Locker read(ResultSet row) throws SQLException {
        return new Locker(
                row.getObject("id", UUID.class),
                row.getString("name"),
                new BlockPosition(row.getString("world"), row.getInt("x"), row.getInt("y"), row.getInt("z")),
                row.getBoolean("active"));
    }
}
