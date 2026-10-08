package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.link.LinkCodeStore;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Duration;
import java.util.UUID;

/** public.link_codes. The web redeems the codes; the plugin only issues them. */
public final class PostgresLinkCodeStore implements LinkCodeStore {

    /** Drops the player's unredeemed codes and any expired unredeemed code. */
    private static final String DELETE_STALE = """
            delete from public.link_codes
            where redeemed_at is null and (player_uuid = ? or expires_at < now())
            """;

    /** Expiry uses the database clock, the same one the web checks against. */
    private static final String INSERT = """
            insert into public.link_codes (code, player_uuid, expires_at)
            values (?, ?, now() + ? * interval '1 second')
            on conflict (code) do nothing
            """;

    private final Database database;

    public PostgresLinkCodeStore(Database database) {
        this.database = database;
    }

    @Override
    public boolean insert(UUID playerId, String playerName, String code, Duration ttl) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                PlayerRepository.upsert(connection, playerId, playerName);
                try (PreparedStatement delete = connection.prepareStatement(DELETE_STALE)) {
                    delete.setObject(1, playerId);
                    delete.executeUpdate();
                }
                int inserted;
                try (PreparedStatement insert = connection.prepareStatement(INSERT)) {
                    insert.setString(1, code);
                    insert.setObject(2, playerId);
                    insert.setLong(3, ttl.toSeconds());
                    inserted = insert.executeUpdate();
                }
                connection.commit();
                return inserted == 1;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }
}
