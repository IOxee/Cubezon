package es.fractalgamestudios.cubezon.roles;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShopPermissionTest {

    /** The database function shop_permission_list() must list exactly these keys. */
    @Test
    void permissionKeysMatchTheMigration() throws IOException {
        Path migration = Path.of("../supabase/migrations/20261010090000_shop_roles.sql");
        String sql = Files.readString(migration);
        Set<String> keys = Arrays.stream(ShopPermission.values()).map(ShopPermission::key).collect(Collectors.toSet());
        String list = sql.substring(sql.indexOf("select array["), sql.indexOf("]::text[]"));
        Set<String> inSql = Arrays.stream(list.split("'")).filter(part -> part.contains(".")).collect(Collectors.toSet());
        assertEquals(keys, inSql);
    }

    @Test
    void unknownKeysAreIgnored() {
        assertEquals(Set.of(ShopPermission.STOCK_DEPOSIT),
                ShopPermission.fromKeys(List.of("stock.deposit", "hack.everything")));
        assertTrue(ShopPermission.byKey("staff.manage").isPresent());
    }
}
