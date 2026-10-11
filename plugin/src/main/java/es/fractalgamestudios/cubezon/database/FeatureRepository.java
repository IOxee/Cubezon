package es.fractalgamestudios.cubezon.database;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

/** public.feature_settings: config.yml options the server owner changed from the web admin panel. */
public final class FeatureRepository {

    private static final String FIND_ALL = "select key, value from public.feature_settings";

    private final Database database;

    public FeatureRepository(Database database) {
        this.database = database;
    }

    /** key (config path) → value as text; validated by the caller. */
    public Map<String, String> findAll() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ALL);
             ResultSet rows = statement.executeQuery()) {
            Map<String, String> overrides = new HashMap<>();
            while (rows.next()) {
                overrides.put(rows.getString("key"), rows.getString("value"));
            }
            return overrides;
        }
    }
}
