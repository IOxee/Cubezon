package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * In-memory copy of shop zones and storage blocks, so placing, breaking and clicking blocks
 * never waits for the database. Replaced on refresh; safe to read from any thread.
 */
public final class StorageRegistry {

    private volatile List<ShopZone> zones = List.of();
    private volatile Map<BlockPosition, StorageBlock> blocks = Map.of();

    public synchronized void replaceAll(List<ShopZone> newZones, List<StorageBlock> newBlocks) {
        zones = List.copyOf(newZones);
        blocks = newBlocks.stream().collect(Collectors.toUnmodifiableMap(StorageBlock::position, Function.identity()));
    }

    public synchronized void putZone(ShopZone zone) {
        var copy = new ArrayList<>(zones);
        copy.removeIf(existing -> existing.shopId().equals(zone.shopId()));
        copy.add(zone);
        zones = List.copyOf(copy);
    }

    public synchronized void putBlock(StorageBlock block) {
        var copy = new HashMap<>(blocks);
        copy.put(block.position(), block);
        blocks = Map.copyOf(copy);
    }

    public synchronized void removeBlock(UUID blockId) {
        var copy = new HashMap<>(blocks);
        copy.values().removeIf(block -> block.id().equals(blockId));
        blocks = Map.copyOf(copy);
    }

    public Optional<ShopZone> zoneAt(BlockPosition position) {
        return zones.stream().filter(zone -> zone.contains(position)).findFirst();
    }

    public Optional<ShopZone> zoneOf(UUID shopId) {
        return zones.stream().filter(zone -> zone.shopId().equals(shopId)).findFirst();
    }

    public @Nullable StorageBlock blockAt(BlockPosition position) {
        return blocks.get(position);
    }
}
