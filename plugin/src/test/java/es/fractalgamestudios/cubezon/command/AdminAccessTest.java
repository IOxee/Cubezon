package es.fractalgamestudios.cubezon.command;

import org.bukkit.permissions.Permissible;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminAccessTest {

    /** A Permissible that answers {@code allowed} and records every permission it was asked about. */
    private static Permissible who(boolean allowed, List<String> asked) {
        return (Permissible) Proxy.newProxyInstance(Permissible.class.getClassLoader(), new Class<?>[]{Permissible.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("hasPermission") && args[0] instanceof String name) {
                        asked.add(name);
                        return allowed;
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    @Test
    void grantedWhenTheSenderHasTheAdminPermission() {
        assertTrue(AdminAccess.has(who(true, new ArrayList<>())));
    }

    @Test
    void deniedWhenTheSenderLacksTheAdminPermission() {
        assertFalse(AdminAccess.has(who(false, new ArrayList<>())));
    }

    @Test
    void asksForExactlyTheAdminPermissionDeclaredInPluginYml() {
        List<String> asked = new ArrayList<>();
        AdminAccess.has(who(false, asked));
        assertEquals(List.of("cubezon.admin"), asked);
    }
}
