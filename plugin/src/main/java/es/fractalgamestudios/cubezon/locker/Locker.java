package es.fractalgamestudios.cubezon.locker;

import java.util.UUID;

/** A pickup point: one block of the world registered by an admin. */
public record Locker(UUID id, String name, BlockPosition position, boolean active) {
}
