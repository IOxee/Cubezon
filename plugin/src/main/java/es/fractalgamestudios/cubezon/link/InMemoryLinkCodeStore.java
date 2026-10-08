package es.fractalgamestudios.cubezon.link;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Fallback store used when the database is disabled. Codes are lost on restart. */
public final class InMemoryLinkCodeStore implements LinkCodeStore {

    private record PendingLink(UUID playerId, Instant expiresAt) {
    }

    private final Clock clock;
    private final Map<String, PendingLink> pending = new ConcurrentHashMap<>();

    public InMemoryLinkCodeStore() {
        this(Clock.systemUTC());
    }

    InMemoryLinkCodeStore(Clock clock) {
        this.clock = clock;
    }

    @Override
    public boolean insert(UUID playerId, String playerName, String code, Duration ttl) {
        pending.values().removeIf(link -> link.playerId().equals(playerId) || isExpired(link));
        return pending.putIfAbsent(code, new PendingLink(playerId, clock.instant().plus(ttl))) == null;
    }

    /** Consumes the code: it can only be redeemed once and only before it expires. */
    public Optional<UUID> redeem(String code) {
        PendingLink link = pending.remove(code);
        if (link == null || isExpired(link)) {
            return Optional.empty();
        }
        return Optional.of(link.playerId());
    }

    private boolean isExpired(PendingLink link) {
        return !clock.instant().isBefore(link.expiresAt());
    }
}
