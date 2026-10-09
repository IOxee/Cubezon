package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.deposit.DepositableListing;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** public.listings, from the seller's point of view. */
public final class ListingRepository {

    /** Listings that accept deposits: approved shops of the owner, not removed. */
    private static final String FIND_DEPOSITABLE = """
            select l.id, l.title, s.name as shop_name, l.item_key, l.material, l.unit_amount, l.unit_price,
                   l.match_mode, l.sample,
                   (select count(*) from public.escrow_items e
                    where e.listing_id = l.id and e.status = 'AVAILABLE') as units_available
            from public.listings l
            join public.shops s on s.id = l.shop_id
            where s.owner_uuid = ? and s.status = 'APPROVED' and l.status <> 'REMOVED'
            order by s.name, l.created_at
            limit ?
            """;

    private static final String FIND_SHOP_STATUSES = "select status::text from public.shops where owner_uuid = ?";

    private final Database database;

    public ListingRepository(Database database) {
        this.database = database;
    }

    public List<DepositableListing> findDepositable(UUID ownerId, int limit) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_DEPOSITABLE)) {
            statement.setObject(1, ownerId);
            statement.setInt(2, limit);
            List<DepositableListing> listings = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    listings.add(new DepositableListing(
                            rows.getObject("id", UUID.class),
                            rows.getString("title"),
                            rows.getString("shop_name"),
                            rows.getString("item_key"),
                            rows.getString("material"),
                            rows.getInt("unit_amount"),
                            rows.getBigDecimal("unit_price"),
                            rows.getInt("units_available"),
                            rows.getString("match_mode"),
                            rows.getBytes("sample")));
                }
            }
            return listings;
        }
    }

    /** Status of every shop the player owns (PENDING, APPROVED, ...); empty if they have none. */
    public List<String> findShopStatuses(UUID ownerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_SHOP_STATUSES)) {
            statement.setObject(1, ownerId);
            List<String> statuses = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    statuses.add(rows.getString(1));
                }
            }
            return statuses;
        }
    }
}
