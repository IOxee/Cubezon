package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.mailbox.Mailbox;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** public.mailboxes. The limit per player is enforced by the database (MAILBOXES_EXCEEDED). */
public final class MailboxRepository {

    public enum PlaceResult { PLACED, LIMIT, OCCUPIED }

    public enum RemoveResult { REMOVED, HAS_ORDERS, NOT_FOUND }

    /** {@code mailbox} is set only when the result is PLACED. */
    public record Placement(PlaceResult result, Mailbox mailbox) {
    }

    private static final String FIND_ALL = """
            select b.id, b.owner_uuid, p.name as owner_name, b.world, b.x, b.y, b.z
            from public.mailboxes b join public.players p on p.uuid = b.owner_uuid
            """;

    private static final String INSERT = """
            insert into public.mailboxes (owner_uuid, world, x, y, z) values (?, ?, ?, ?, ?) returning id
            """;

    /** Never while an order still has to arrive there or be collected from it. */
    private static final String OPEN_ORDERS = """
            select count(*) from public.orders where mailbox_id = ? and status in ('PENDING', 'PAID', 'READY')
            """;

    private static final String DELETE = "delete from public.mailboxes where id = ?";

    private final Database database;

    public MailboxRepository(Database database) {
        this.database = database;
    }

    public List<Mailbox> findAll() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ALL);
             ResultSet rows = statement.executeQuery()) {
            List<Mailbox> mailboxes = new ArrayList<>();
            while (rows.next()) {
                mailboxes.add(new Mailbox(rows.getObject("id", UUID.class), rows.getObject("owner_uuid", UUID.class),
                        rows.getString("owner_name"),
                        new BlockPosition(rows.getString("world"), rows.getInt("x"), rows.getInt("y"), rows.getInt("z"))));
            }
            return mailboxes;
        }
    }

    public Placement place(UUID ownerId, String ownerName, BlockPosition position) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(INSERT)) {
            statement.setObject(1, ownerId);
            statement.setString(2, position.world());
            statement.setInt(3, position.x());
            statement.setInt(4, position.y());
            statement.setInt(5, position.z());
            try (ResultSet row = statement.executeQuery()) {
                row.next();
                return new Placement(PlaceResult.PLACED, new Mailbox(row.getObject("id", UUID.class), ownerId, ownerName, position));
            }
        } catch (SQLException e) {
            if ("23514".equals(e.getSQLState()) && String.valueOf(e.getMessage()).contains("MAILBOXES_EXCEEDED")) {
                return new Placement(PlaceResult.LIMIT, null);
            }
            if ("23505".equals(e.getSQLState())) {
                return new Placement(PlaceResult.OCCUPIED, null);
            }
            throw e;
        }
    }

    public RemoveResult remove(UUID mailboxId) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement lock = connection.prepareStatement("select id from public.mailboxes where id = ? for update")) {
                    lock.setObject(1, mailboxId);
                    try (ResultSet row = lock.executeQuery()) {
                        if (!row.next()) {
                            connection.rollback();
                            return RemoveResult.NOT_FOUND;
                        }
                    }
                }
                try (PreparedStatement count = connection.prepareStatement(OPEN_ORDERS)) {
                    count.setObject(1, mailboxId);
                    try (ResultSet row = count.executeQuery()) {
                        row.next();
                        if (row.getInt(1) > 0) {
                            connection.rollback();
                            return RemoveResult.HAS_ORDERS;
                        }
                    }
                }
                try (PreparedStatement delete = connection.prepareStatement(DELETE)) {
                    delete.setObject(1, mailboxId);
                    delete.executeUpdate();
                }
                connection.commit();
                return RemoveResult.REMOVED;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }
}
