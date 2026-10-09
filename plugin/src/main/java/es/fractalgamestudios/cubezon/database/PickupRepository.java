package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.pickup.ReadyOrder;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** READY orders waiting at a locker, and handing them over (READY → COLLECTED). */
public final class PickupRepository {

    private static final String FIND_READY = """
            select o.id, o.quantity, l.title, s.name as shop_name, e.item_data
            from public.orders o
            join public.listings l on l.id = o.listing_id
            join public.shops s on s.id = o.shop_id
            join public.escrow_items e on e.order_id = o.id and e.status = 'RESERVED'
            where o.buyer_uuid = ? and o.locker_id = ? and o.status = 'READY'
            order by o.ready_at, o.id, e.id
            """;

    /** Only the buyer, only while READY: a second attempt finds nothing to collect. */
    private static final String MARK_COLLECTED = """
            update public.orders set status = 'COLLECTED', collected_at = now()
            where id = ? and buyer_uuid = ? and status = 'READY'
            """;

    private static final String DELIVER_UNITS = """
            update public.escrow_items set status = 'DELIVERED'
            where order_id = ? and status = 'RESERVED'
            returning item_data
            """;

    private final Database database;

    public PickupRepository(Database database) {
        this.database = database;
    }

    public List<ReadyOrder> findReady(UUID buyerId, UUID lockerId) throws SQLException {
        return findReady(FIND_READY, buyerId, lockerId);
    }

    /** Express orders waiting in the buyer's mailbox. */
    public List<ReadyOrder> findReadyAtMailbox(UUID buyerId, UUID mailboxId) throws SQLException {
        return findReady(FIND_READY.replace("o.locker_id = ?", "o.mailbox_id = ?"), buyerId, mailboxId);
    }

    private List<ReadyOrder> findReady(String sql, UUID buyerId, UUID lockerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, buyerId);
            statement.setObject(2, lockerId);
            Map<UUID, ReadyOrder> orders = new LinkedHashMap<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    UUID id = rows.getObject("id", UUID.class);
                    String title = rows.getString("title");
                    String shopName = rows.getString("shop_name");
                    int quantity = rows.getInt("quantity");
                    orders.computeIfAbsent(id, key -> new ReadyOrder(key, title, shopName, quantity, new ArrayList<>()))
                            .units().add(rows.getBytes("item_data"));
                }
            }
            return List.copyOf(orders.values());
        }
    }

    /**
     * Marks the order COLLECTED and its units DELIVERED in one transaction, and returns the
     * units to hand over. Empty if the order is not (or no longer) READY for this buyer.
     */
    public Optional<List<byte[]>> collect(UUID orderId, UUID buyerId) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement collect = connection.prepareStatement(MARK_COLLECTED)) {
                    collect.setObject(1, orderId);
                    collect.setObject(2, buyerId);
                    if (collect.executeUpdate() == 0) {
                        connection.rollback();
                        return Optional.empty();
                    }
                }
                List<byte[]> units = new ArrayList<>();
                try (PreparedStatement deliver = connection.prepareStatement(DELIVER_UNITS)) {
                    deliver.setObject(1, orderId);
                    try (ResultSet rows = deliver.executeQuery()) {
                        while (rows.next()) {
                            units.add(rows.getBytes("item_data"));
                        }
                    }
                }
                connection.commit();
                return Optional.of(units);
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }
}
