package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.storage.StorageType;
import org.bukkit.Material;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** public.storage_types: storage blocks admins can define (block, capacity, price). */
public final class StorageTypeRepository {

    public enum RemoveResult { DELETED, RETIRED, NOT_FOUND }

    private static final String FIND_ALL = """
            select id, display_name, material, capacity, price, buyable from public.storage_types order by capacity, id
            """;

    private static final String UPSERT = """
            insert into public.storage_types (id, display_name, material, capacity, price, buyable, created_by)
            values (?, ?, ?, ?, ?, true, ?)
            on conflict (id) do update set display_name = excluded.display_name, material = excluded.material,
                capacity = excluded.capacity, price = excluded.price, buyable = true
            """;

    private static final String IN_USE = "select count(*) from public.storage_blocks where type_id = ?";

    private static final String DELETE = "delete from public.storage_types where id = ?";

    private static final String RETIRE = "update public.storage_types set buyable = false where id = ?";

    private final Database database;

    public StorageTypeRepository(Database database) {
        this.database = database;
    }

    /** Types whose block no longer exists in this server version are skipped. */
    public List<StorageType> findAll() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ALL);
             ResultSet rows = statement.executeQuery()) {
            List<StorageType> types = new ArrayList<>();
            while (rows.next()) {
                Material material = Material.matchMaterial(rows.getString("material"));
                if (material == null) {
                    continue;
                }
                types.add(new StorageType(rows.getString("id"), rows.getString("display_name"), material,
                        rows.getInt("capacity"), rows.getBigDecimal("price"), rows.getBoolean("buyable")));
            }
            return types;
        }
    }

    /** Creates the type, or updates it (and puts it back on sale) if the id exists. */
    public void upsert(StorageType type, UUID createdBy) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(UPSERT)) {
            statement.setString(1, type.id());
            statement.setString(2, type.displayName());
            statement.setString(3, type.material().getKey().getKey());
            statement.setInt(4, type.capacity());
            statement.setBigDecimal(5, type.price());
            statement.setObject(6, createdBy);
            statement.executeUpdate();
        }
    }

    /** Deleted when no placed block uses it; otherwise retired, so placed blocks keep working. */
    public RemoveResult remove(String id) throws SQLException {
        try (Connection connection = database.connection()) {
            int inUse;
            try (PreparedStatement count = connection.prepareStatement(IN_USE)) {
                count.setString(1, id);
                try (ResultSet row = count.executeQuery()) {
                    row.next();
                    inUse = row.getInt(1);
                }
            }
            try (PreparedStatement statement = connection.prepareStatement(inUse == 0 ? DELETE : RETIRE)) {
                statement.setString(1, id);
                if (statement.executeUpdate() == 0) {
                    return RemoveResult.NOT_FOUND;
                }
            }
            return inUse == 0 ? RemoveResult.DELETED : RemoveResult.RETIRED;
        }
    }
}
