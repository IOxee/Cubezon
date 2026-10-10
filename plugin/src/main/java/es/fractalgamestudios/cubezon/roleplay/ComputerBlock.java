package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.locker.BlockPosition;

import java.util.UUID;

/** A placed company computer: the order inbox of its shop. */
public record ComputerBlock(UUID id, UUID shopId, String shopName, BlockPosition position) {
}
