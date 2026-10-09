package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.item.ItemKey;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;

/** public.custom_items: the catalog of non-vanilla items the web can list. */
public final class CustomItemRepository {

    /** Re-registering an item refreshes its data but keeps the icon uploaded on the web. */
    private static final String UPSERT = """
            insert into public.custom_items (key, display_name, base_material, max_stack, source, sample, registered_by)
            values (?, ?, ?, ?, ?, ?, ?)
            on conflict (key) do update set
                display_name = excluded.display_name, base_material = excluded.base_material,
                max_stack = excluded.max_stack, source = excluded.source, sample = excluded.sample,
                registered_by = excluded.registered_by
            returning (xmax = 0) as inserted
            """;

    private final Database database;

    public CustomItemRepository(Database database) {
        this.database = database;
    }

    /** @return true if it was new, false if an existing entry was updated */
    public boolean register(ItemKey key, String displayName, int maxStack, byte[] sample, UUID registeredBy)
            throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(UPSERT)) {
            statement.setString(1, key.key());
            statement.setString(2, displayName);
            statement.setString(3, key.baseMaterial());
            statement.setInt(4, maxStack);
            statement.setString(5, key.source());
            statement.setBytes(6, sample);
            statement.setObject(7, registeredBy);
            try (var row = statement.executeQuery()) {
                row.next();
                return row.getBoolean("inserted");
            }
        }
    }
}
