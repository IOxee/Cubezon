package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import org.jetbrains.annotations.Nullable;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** In-memory copy of public.shop_computers, so block events never wait for the database. */
public final class ComputerRegistry {

    private volatile Map<BlockPosition, ComputerBlock> computers = Map.of();

    public synchronized void replaceAll(List<ComputerBlock> all) {
        computers = all.stream().collect(Collectors.toUnmodifiableMap(ComputerBlock::position, Function.identity()));
    }

    public synchronized void put(ComputerBlock computer) {
        var copy = new HashMap<>(computers);
        copy.put(computer.position(), computer);
        computers = Map.copyOf(copy);
    }

    public synchronized void remove(UUID computerId) {
        var copy = new HashMap<>(computers);
        copy.values().removeIf(computer -> computer.id().equals(computerId));
        computers = Map.copyOf(copy);
    }

    public @Nullable ComputerBlock at(BlockPosition position) {
        return computers.get(position);
    }
}
