package es.fractalgamestudios.cubezon.link;

import java.sql.SQLException;
import java.time.Duration;
import java.util.UUID;

/** Where issued link codes live: the database, or memory when it is disabled. */
public interface LinkCodeStore {

    /**
     * Stores a new code for the player, invalidating their previous unredeemed codes.
     *
     * @return false if the code is already taken (the caller retries with another one)
     */
    boolean insert(UUID playerId, String playerName, String code, Duration ttl) throws SQLException;
}
