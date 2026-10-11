package es.fractalgamestudios.cubezon.kiosk;

import es.fractalgamestudios.cubezon.locker.BlockPosition;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** In-memory copy of public.kiosks, so clicks and breaks never wait for the database. Any thread. */
public final class KioskRegistry {

    private static final Comparator<BlockPosition> ORDER = Comparator.comparing(BlockPosition::world)
            .thenComparingInt(BlockPosition::x).thenComparingInt(BlockPosition::y).thenComparingInt(BlockPosition::z);

    private volatile Set<BlockPosition> kiosks = Set.of();

    public synchronized void replaceAll(List<BlockPosition> all) {
        kiosks = Set.copyOf(all);
    }

    public synchronized void add(BlockPosition position) {
        var copy = new HashSet<>(kiosks);
        copy.add(position);
        kiosks = Set.copyOf(copy);
    }

    public synchronized void remove(BlockPosition position) {
        var copy = new HashSet<>(kiosks);
        copy.remove(position);
        kiosks = Set.copyOf(copy);
    }

    public boolean contains(BlockPosition position) {
        return kiosks.contains(position);
    }

    /** Every kiosk, by world and coordinates. */
    public List<BlockPosition> all() {
        return kiosks.stream().sorted(ORDER).toList();
    }
}
