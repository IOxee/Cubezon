package es.fractalgamestudios.cubezon.locker;

import org.bukkit.block.Block;

/** World name + block coordinates, usable as a map key without holding Bukkit objects. */
public record BlockPosition(String world, int x, int y, int z) {

    public static BlockPosition of(Block block) {
        return new BlockPosition(block.getWorld().getName(), block.getX(), block.getY(), block.getZ());
    }

    public double distanceSquared(String otherWorld, double otherX, double otherY, double otherZ) {
        if (!world.equals(otherWorld)) {
            return Double.MAX_VALUE;
        }
        double dx = x + 0.5 - otherX;
        double dy = y + 0.5 - otherY;
        double dz = z + 0.5 - otherZ;
        return dx * dx + dy * dy + dz * dz;
    }
}
