package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.locker.BlockPosition;

import java.util.UUID;

/** A placed company computer: the full control panel of its shop or a delivery terminal. */
public record ComputerBlock(UUID id, UUID shopId, String shopName, BlockPosition position, ComputerKind kind) {
}
