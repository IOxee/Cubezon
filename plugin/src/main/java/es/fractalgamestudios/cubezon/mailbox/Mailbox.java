package es.fractalgamestudios.cubezon.mailbox;

import es.fractalgamestudios.cubezon.locker.BlockPosition;

import java.util.UUID;

/** A player's personal mailbox: express orders are delivered straight into it. */
public record Mailbox(UUID id, UUID ownerId, String ownerName, BlockPosition position) {
}
