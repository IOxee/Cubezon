package es.fractalgamestudios.cubezon.mailbox;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** In-memory copy of public.mailboxes, so block events never wait for the database. */
public final class MailboxRegistry {

    private volatile Map<BlockPosition, Mailbox> mailboxes = Map.of();

    public synchronized void replaceAll(List<Mailbox> all) {
        mailboxes = all.stream().collect(Collectors.toUnmodifiableMap(Mailbox::position, Function.identity()));
    }

    public synchronized void put(Mailbox mailbox) {
        var copy = new HashMap<>(mailboxes);
        copy.put(mailbox.position(), mailbox);
        mailboxes = Map.copyOf(copy);
    }

    public synchronized void remove(UUID mailboxId) {
        var copy = new HashMap<>(mailboxes);
        copy.values().removeIf(mailbox -> mailbox.id().equals(mailboxId));
        mailboxes = Map.copyOf(copy);
    }

    public @Nullable Mailbox at(BlockPosition position) {
        return mailboxes.get(position);
    }

    public List<Mailbox> ownedBy(UUID playerId) {
        return mailboxes.values().stream().filter(mailbox -> mailbox.ownerId().equals(playerId)).toList();
    }
}
