package es.fractalgamestudios.cubezon.database;

import org.jetbrains.annotations.Nullable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

/**
 * How many shops each player may have. The database enforces the limit (trigger on shops); this
 * only reads and changes it. players.shop_slots null = the default from config.yml.
 */
public final class ShopSlotsRepository {

    public record Slots(UUID playerId, String playerName, int slots, int used, int free, boolean custom) {
    }

    private static final String FIND = """
            select p.uuid, p.name, s.slots, s.used, s.free, s.custom
            from public.players p, public.shop_slots_of(p.uuid) s
            where lower(p.name) = lower(?)
            """;

    private static final String SET = "update public.players set shop_slots = ? where lower(name) = lower(?)";

    private final Database database;

    public ShopSlotsRepository(Database database) {
        this.database = database;
    }

    /** Empty if no player with that name ever joined the server. */
    public Optional<Slots> find(String playerName) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND)) {
            statement.setString(1, playerName);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    return Optional.empty();
                }
                return Optional.of(new Slots(row.getObject("uuid", UUID.class), row.getString("name"), row.getInt("slots"),
                        row.getInt("used"), row.getInt("free"), row.getBoolean("custom")));
            }
        }
    }

    /** {@code slots} null = back to the default. @return false if the player is unknown */
    public boolean set(String playerName, @Nullable Integer slots) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(SET)) {
            if (slots == null) {
                statement.setNull(1, java.sql.Types.INTEGER);
            } else {
                statement.setInt(1, slots);
            }
            statement.setString(2, playerName);
            return statement.executeUpdate() > 0;
        }
    }
}
