package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.database.ShopPanelRepository.ShopInfo;
import es.fractalgamestudios.cubezon.roles.ShopPermission;

import java.util.Set;

/** Who is looking at which shop. */
record PanelContext(ComputerBlock computer, ShopInfo shop, boolean owner, Set<ShopPermission> permissions) {

    boolean can(ShopPermission permission) {
        return permissions.contains(permission);
    }
}
