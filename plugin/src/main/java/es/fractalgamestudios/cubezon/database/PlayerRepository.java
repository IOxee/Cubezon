package es.fractalgamestudios.cubezon.database;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;

/** public.players: Minecraft accounts known to Cubezon. */
public final class PlayerRepository {

    private static final String UPSERT = """
            insert into public.players (uuid, name, last_seen_at)
            values (?, ?, now())
            on conflict (uuid) do update set name = excluded.name, last_seen_at = now()
            """;

    private final Database database;

    public PlayerRepository(Database database) {
        this.database = database;
    }

    /** Creates the player or refreshes their name and last_seen_at. */
    public void upsert(UUID playerId, String name) throws SQLException {
        try (Connection connection = database.connection()) {
            upsert(connection, playerId, name);
        }
    }

    static void upsert(Connection connection, UUID playerId, String name) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(UPSERT)) {
            statement.setObject(1, playerId);
            statement.setString(2, name);
            statement.executeUpdate();
        }
    }
}
