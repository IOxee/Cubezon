package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.jetbrains.annotations.Nullable;

import java.util.UUID;

/**
 * A placed storage block: adds {@code capacity} units to its shop (the capacity of its type when
 * it was placed). {@code typeId} is null only if its type was deleted.
 */
public record StorageBlock(UUID id, UUID shopId, String shopName, BlockPosition position, int capacity,
                           @Nullable String typeId) {
}
