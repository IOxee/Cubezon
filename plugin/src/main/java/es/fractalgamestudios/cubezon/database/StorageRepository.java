package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.storage.ShopZone;
import es.fractalgamestudios.cubezon.storage.StorageBlock;
import org.jetbrains.annotations.Nullable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Shop zones (public.shops zone_*) and public.storage_blocks. */
public final class StorageRepository {

    /** Usage and capacity of one of the player's shops. */
    public record ShopStorage(String shopName, String status, boolean hasZone, int blocks, int used, int capacity) {
    }

    /** A shop found by slug or id, for the zone wand. */
    public record ShopRef(UUID id, String name, String slug) {
    }

    public enum ZoneResult { SAVED, NOT_FOUND, OVERLAPS }

    /** {@code zone} is set only when the result is SAVED. */
    public record ZoneUpdate(ZoneResult result, @Nullable ShopZone zone) {
    }

    private static final String EXCLUSION_VIOLATION = "23P01";

    private static final String ZONE_COLUMNS = """
            s.id, s.owner_uuid, s.name, s.slug, s.zone_world,
            s.zone_min_x, s.zone_min_y, s.zone_min_z, s.zone_max_x, s.zone_max_y, s.zone_max_z
            """;

    private static final String FIND_ZONES =
            "select " + ZONE_COLUMNS + " from public.shops s where s.zone_world is not null";

    private static final String SET_ZONE = """
            update public.shops s
            set zone_world = ?, zone_min_x = ?, zone_min_y = ?, zone_min_z = ?,
                zone_max_x = ?, zone_max_y = ?, zone_max_z = ?
            where s.id = ?
            returning\s""" + ZONE_COLUMNS;

    /** By slug (current or a previous one) or id only: names are not unique. */
    private static final String FIND_SHOP = """
            select id, name, slug from public.shops
            where slug = ? or id::text = lower(?)
               or id = (select h.shop_id from public.shop_slug_history h where h.slug = ?)
            """;

    private static final String FIND_SLUGS = """
            select slug from public.shops where slug like ? escape '\\' order by slug limit 25
            """;

    private static final String FIND_BLOCKS = """
            select b.id, b.shop_id, s.name as shop_name, b.world, b.x, b.y, b.z, b.capacity, b.type_id
            from public.storage_blocks b
            join public.shops s on s.id = b.shop_id
            """;

    private static final String INSERT_BLOCK = """
            insert into public.storage_blocks (shop_id, world, x, y, z, capacity, placed_by, type_id)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            returning id
            """;

    private static final String DELETE_BLOCK = "delete from public.storage_blocks where id = ?";

    private static final String FIND_STORAGE_OF_OWNER = """
            select s.name, s.status::text as status, s.zone_world is not null as has_zone,
                   st.storage_blocks, st.used_units, st.capacity_units
            from public.shops s
            join public.shop_storage st on st.shop_id = s.id
            where s.owner_uuid = ?
            order by s.name
            """;

    private final Database database;

    public StorageRepository(Database database) {
        this.database = database;
    }

    public List<ShopZone> findZones() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ZONES);
             ResultSet rows = statement.executeQuery()) {
            List<ShopZone> zones = new ArrayList<>();
            while (rows.next()) {
                zones.add(readZone(rows));
            }
            return zones;
        }
    }

    /** The shop whose slug or id is {@code key}. */
    public Optional<ShopRef> findShop(String key) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_SHOP)) {
            statement.setString(1, key);
            statement.setString(2, key);
            statement.setString(3, key);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    return Optional.empty();
                }
                return Optional.of(new ShopRef(row.getObject("id", UUID.class), row.getString("name"), row.getString("slug")));
            }
        }
    }

    /** Slugs starting with {@code prefix}, for command suggestions. */
    public List<String> findSlugs(String prefix) throws SQLException {
        String pattern = prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_SLUGS)) {
            statement.setString(1, pattern);
            List<String> slugs = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    slugs.add(rows.getString(1));
                }
            }
            return slugs;
        }
    }

    /** Saves the zone of the shop; corners can be given in any order. */
    public ZoneUpdate setZone(UUID shopId, BlockPosition corner1, BlockPosition corner2) throws SQLException {
        ShopZone zone = ShopZone.of(shopId, null, "", "", corner1, corner2);
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(SET_ZONE)) {
            statement.setString(1, zone.world());
            statement.setInt(2, zone.minX());
            statement.setInt(3, zone.minY());
            statement.setInt(4, zone.minZ());
            statement.setInt(5, zone.maxX());
            statement.setInt(6, zone.maxY());
            statement.setInt(7, zone.maxZ());
            statement.setObject(8, shopId);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    return new ZoneUpdate(ZoneResult.NOT_FOUND, null);
                }
                return new ZoneUpdate(ZoneResult.SAVED, readZone(row));
            }
        } catch (SQLException e) {
            if (EXCLUSION_VIOLATION.equals(e.getSQLState())) {
                return new ZoneUpdate(ZoneResult.OVERLAPS, null);
            }
            throw e;
        }
    }

    public List<StorageBlock> findBlocks() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_BLOCKS);
             ResultSet rows = statement.executeQuery()) {
            List<StorageBlock> blocks = new ArrayList<>();
            while (rows.next()) {
                blocks.add(new StorageBlock(
                        rows.getObject("id", UUID.class),
                        rows.getObject("shop_id", UUID.class),
                        rows.getString("shop_name"),
                        new BlockPosition(rows.getString("world"), rows.getInt("x"), rows.getInt("y"), rows.getInt("z")),
                        rows.getInt("capacity"),
                        rows.getString("type_id")));
            }
            return blocks;
        }
    }

    public StorageBlock insertBlock(ShopZone zone, BlockPosition position, int capacity, String typeId, UUID placedBy)
            throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(INSERT_BLOCK)) {
            statement.setObject(1, zone.shopId());
            statement.setString(2, position.world());
            statement.setInt(3, position.x());
            statement.setInt(4, position.y());
            statement.setInt(5, position.z());
            statement.setInt(6, capacity);
            statement.setObject(7, placedBy);
            statement.setString(8, typeId);
            try (ResultSet row = statement.executeQuery()) {
                row.next();
                return new StorageBlock(row.getObject("id", UUID.class), zone.shopId(), zone.shopName(), position, capacity,
                        typeId);
            }
        }
    }

    /** @return false if the block was already gone (e.g. two break attempts at once) */
    public boolean deleteBlock(UUID blockId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(DELETE_BLOCK)) {
            statement.setObject(1, blockId);
            return statement.executeUpdate() > 0;
        }
    }

    public List<ShopStorage> findStorageOf(UUID ownerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_STORAGE_OF_OWNER)) {
            statement.setObject(1, ownerId);
            List<ShopStorage> shops = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    shops.add(new ShopStorage(rows.getString("name"), rows.getString("status"),
                            rows.getBoolean("has_zone"), rows.getInt("storage_blocks"),
                            rows.getInt("used_units"), rows.getInt("capacity_units")));
                }
            }
            return shops;
        }
    }

    private static ShopZone readZone(ResultSet row) throws SQLException {
        return new ShopZone(
                row.getObject("id", UUID.class),
                row.getObject("owner_uuid", UUID.class),
                row.getString("name"),
                row.getString("slug"),
                row.getString("zone_world"),
                row.getInt("zone_min_x"), row.getInt("zone_min_y"), row.getInt("zone_min_z"),
                row.getInt("zone_max_x"), row.getInt("zone_max_y"), row.getInt("zone_max_z"));
    }
}
