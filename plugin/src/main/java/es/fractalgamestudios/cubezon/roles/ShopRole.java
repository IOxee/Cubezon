package es.fractalgamestudios.cubezon.roles;

import java.util.Set;
import java.util.UUID;

/** A rank inside a shop. {@code members} is how many employees have it. */
public record ShopRole(UUID id, String name, int position, Set<ShopPermission> permissions, boolean isDefault, int members) {
}
