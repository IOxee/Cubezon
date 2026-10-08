package es.fractalgamestudios.cubezon.link;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.random.RandomGenerator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LinkServiceTest {

    private static final Duration TTL = Duration.ofMinutes(10);

    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T12:00:00Z"));
    private final InMemoryLinkCodeStore store = new InMemoryLinkCodeStore(clock);
    private final LinkService service = new LinkService(new LinkCodeGenerator(), store, TTL);

    @Test
    void generatedCodesUseTheUnambiguousAlphabet() {
        var generator = new LinkCodeGenerator();
        for (int i = 0; i < 100; i++) {
            String code = generator.next();
            assertEquals(LinkCodeGenerator.LENGTH, code.length());
            assertTrue(code.chars().allMatch(c -> LinkCodeGenerator.ALPHABET.indexOf(c) >= 0), code);
        }
    }

    @Test
    void codeCanBeRedeemedOnlyOnce() throws Exception {
        UUID player = UUID.randomUUID();
        String code = service.createCode(player, "Steve");

        assertEquals(player, store.redeem(code).orElseThrow());
        assertTrue(store.redeem(code).isEmpty());
    }

    @Test
    void expiredCodeIsRejected() throws Exception {
        String code = service.createCode(UUID.randomUUID(), "Steve");
        clock.advance(TTL);

        assertTrue(store.redeem(code).isEmpty());
    }

    @Test
    void newCodeReplacesThePreviousOneForTheSamePlayer() throws Exception {
        UUID player = UUID.randomUUID();
        String first = service.createCode(player, "Steve");
        String second = service.createCode(player, "Steve");

        assertNotEquals(first, second);
        assertTrue(store.redeem(first).isEmpty());
        assertEquals(player, store.redeem(second).orElseThrow());
    }

    @Test
    void takenCodesAreRetriedAndEventuallyGiveUp() throws Exception {
        // A generator that always produces the same code: the second player can never get one.
        RandomGenerator alwaysZero = () -> 0L;
        var fixed = new LinkService(new LinkCodeGenerator(alwaysZero), store, TTL);
        fixed.createCode(UUID.randomUUID(), "Steve");

        assertThrows(IllegalStateException.class, () -> fixed.createCode(UUID.randomUUID(), "Alex"));
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
