package es.fractalgamestudios.cubezon.command;

import org.bukkit.permissions.Permissible;

/** What "admin" means: the {@code cubezon.admin} permission (plugin.yml, default op). See {@link Perm} for the finer nodes. */
public final class AdminAccess {

    public static final String PERMISSION = Perm.ADMIN.node();

    private AdminAccess() {
    }

    public static boolean has(Permissible who) {
        return Perm.ADMIN.has(who);
    }
}
