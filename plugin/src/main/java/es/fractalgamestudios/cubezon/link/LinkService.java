package es.fractalgamestudios.cubezon.link;

import java.sql.SQLException;
import java.time.Duration;
import java.util.UUID;

/** Issues single-use link codes. Blocking: never call it from the main server thread. */
public final class LinkService {

    private static final int MAX_ATTEMPTS = 5;

    private final LinkCodeGenerator generator;
    private final LinkCodeStore store;
    private final Duration ttl;

    public LinkService(LinkCodeGenerator generator, LinkCodeStore store, Duration ttl) {
        this.generator = generator;
        this.store = store;
        this.ttl = ttl;
    }

    /** Creates a new code for the player, replacing any previous one. */
    public String createCode(UUID playerId, String playerName) throws SQLException {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String code = generator.next();
            if (store.insert(playerId, playerName, code, ttl)) {
                return code;
            }
        }
        throw new IllegalStateException("Could not find a free link code after " + MAX_ATTEMPTS + " attempts");
    }

    public Duration ttl() {
        return ttl;
    }
}
