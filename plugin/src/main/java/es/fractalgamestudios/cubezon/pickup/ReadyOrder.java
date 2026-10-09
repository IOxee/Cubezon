package es.fractalgamestudios.cubezon.pickup;

import java.util.List;
import java.util.UUID;

/** An order waiting at a locker, with its reserved units (serialized ItemStacks). */
public record ReadyOrder(UUID id, String title, String shopName, int quantity, List<byte[]> units) {
}
