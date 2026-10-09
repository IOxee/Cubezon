package es.fractalgamestudios.cubezon.locker;

import org.jetbrains.annotations.Nullable;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * In-memory copy of public.lockers, so block interactions never hit the database.
 * Replaced as a whole on every refresh; safe to read from any thread.
 */
public final class LockerRegistry {

    private volatile Map<BlockPosition, Locker> byPosition = Map.of();

    public synchronized void replaceAll(List<Locker> lockers) {
        byPosition = lockers.stream().collect(Collectors.toUnmodifiableMap(Locker::position, Function.identity()));
    }

    public synchronized void put(Locker locker) {
        var copy = new HashMap<>(byPosition);
        copy.values().removeIf(existing -> existing.id().equals(locker.id()));
        copy.put(locker.position(), locker);
        byPosition = Map.copyOf(copy);
    }

    public synchronized void remove(String name) {
        var copy = new HashMap<>(byPosition);
        copy.values().removeIf(existing -> existing.name().equalsIgnoreCase(name));
        byPosition = Map.copyOf(copy);
    }

    public @Nullable Locker at(BlockPosition position) {
        return byPosition.get(position);
    }

    public Optional<Locker> byId(java.util.UUID id) {
        return byPosition.values().stream().filter(locker -> locker.id().equals(id)).findFirst();
    }

    /** Closest locker (active or not) within the radius, in blocks. */
    public Optional<Locker> nearest(String world, double x, double y, double z, double radius) {
        double maxDistanceSquared = radius * radius;
        return byPosition.values().stream()
                .filter(locker -> locker.position().distanceSquared(world, x, y, z) <= maxDistanceSquared)
                .min(Comparator.comparingDouble(locker -> locker.position().distanceSquared(world, x, y, z)));
    }

    public List<String> names() {
        return byPosition.values().stream().map(Locker::name).sorted().toList();
    }
}
