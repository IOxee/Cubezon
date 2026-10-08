package es.fractalgamestudios.cubezon.database;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.bukkit.configuration.ConfigurationSection;
import org.jetbrains.annotations.Nullable;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.logging.Logger;

/** Connection pool to PostgreSQL (Supabase). Never use it from the main server thread. */
public final class Database implements AutoCloseable {

    private final HikariDataSource dataSource;

    private Database(HikariDataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Returns null when the database is disabled or not configured.
     * Setting the CUBEZON_DB_URL environment variable enables it regardless of config.yml.
     */
    public static @Nullable Database fromConfig(ConfigurationSection config, Logger logger) {
        String envUrl = System.getenv("CUBEZON_DB_URL");
        boolean fromEnv = envUrl != null && !envUrl.isBlank();
        if (!fromEnv && !config.getBoolean("database.enabled", false)) {
            logger.info("Database disabled in config.yml.");
            return null;
        }
        String url = setting("CUBEZON_DB_URL", config.getString("database.url", ""));
        if (url.isBlank()) {
            logger.warning("Database enabled but no URL configured; skipping.");
            return null;
        }

        HikariConfig hikari = new HikariConfig();
        hikari.setPoolName("Cubezon");
        hikari.setDriverClassName("org.postgresql.Driver");
        hikari.setJdbcUrl(url);
        hikari.setUsername(setting("CUBEZON_DB_USER", config.getString("database.user", "")));
        hikari.setPassword(setting("CUBEZON_DB_PASSWORD", config.getString("database.password", "")));
        hikari.setMaximumPoolSize(config.getInt("database.pool-size", 4));
        try {
            Database database = new Database(new HikariDataSource(hikari));
            logger.info("Connected to the database" + (fromEnv ? " (from environment)." : "."));
            return database;
        } catch (RuntimeException e) {
            logger.severe("Could not connect to the database: " + e.getMessage());
            return null;
        }
    }

    public Connection connection() throws SQLException {
        return dataSource.getConnection();
    }

    @Override
    public void close() {
        dataSource.close();
    }

    private static String setting(String envVar, @Nullable String fallback) {
        String value = System.getenv(envVar);
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback == null ? "" : fallback;
    }
}
