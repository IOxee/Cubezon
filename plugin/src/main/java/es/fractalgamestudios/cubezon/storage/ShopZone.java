package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.locker.BlockPosition;

import java.util.UUID;

/** Cuboid of the world that belongs to a shop (both corners inclusive). */
public record ShopZone(UUID shopId, UUID ownerId, String shopName, String slug,
                       String world, int minX, int minY, int minZ, int maxX, int maxY, int maxZ) {

    /** Normalizes two corners in any order into a zone. Both corners must be in the same world. */
    public static ShopZone of(UUID shopId, UUID ownerId, String shopName, String slug,
                              BlockPosition corner1, BlockPosition corner2) {
        if (!corner1.world().equals(corner2.world())) {
            throw new IllegalArgumentException("Corners are in different worlds");
        }
        return new ShopZone(shopId, ownerId, shopName, slug, corner1.world(),
                Math.min(corner1.x(), corner2.x()), Math.min(corner1.y(), corner2.y()), Math.min(corner1.z(), corner2.z()),
                Math.max(corner1.x(), corner2.x()), Math.max(corner1.y(), corner2.y()), Math.max(corner1.z(), corner2.z()));
    }

    public boolean contains(BlockPosition position) {
        return world.equals(position.world())
                && position.x() >= minX && position.x() <= maxX
                && position.y() >= minY && position.y() <= maxY
                && position.z() >= minZ && position.z() <= maxZ;
    }

    public int sizeX() {
        return maxX - minX + 1;
    }

    public int sizeY() {
        return maxY - minY + 1;
    }

    public int sizeZ() {
        return maxZ - minZ + 1;
    }
}
