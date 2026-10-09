package es.fractalgamestudios.cubezon.database;

import org.jetbrains.annotations.Nullable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** public.escrow_items: items held by Cubezon on behalf of sellers. */
public final class EscrowRepository {

    /** Outcome of a deposit. {@code stored} may be less than requested when the shop is full. */
    public record DepositResult(boolean listingValid, int stored, int usedBefore, int capacity) {

        static DepositResult invalidListing() {
            return new DepositResult(false, 0, 0, 0);
        }
    }

    /**
     * Locks the listing (so it cannot change while units are inserted) and the shop row (so two
     * deposits into the same shop cannot both use the last free slots).
     */
    private static final String LOCK_LISTING = """
            select l.item_key, l.unit_amount, l.match_mode, l.sample, s.id as shop_id
            from public.listings l
            join public.shops s on s.id = l.shop_id
            where l.id = ? and s.status = 'APPROVED' and l.status <> 'REMOVED'
              and public.shop_member_can(s.id, ?, 'stock.deposit')
            for update of s for share of l
            """;

    /** Units held count against capacity until they are delivered. */
    private static final String STORAGE = """
            select (select coalesce(sum(b.capacity), 0) from public.storage_blocks b where b.shop_id = ?) as capacity,
                   (select count(*) from public.escrow_items e
                    join public.listings l on l.id = e.listing_id
                    where l.shop_id = ? and e.status in ('AVAILABLE', 'RESERVED')) as used
            """;

    private static final String INSERT_UNIT = """
            insert into public.escrow_items (listing_id, item_data) values (?, ?)
            """;

    private final Database database;

    public EscrowRepository(Database database) {
        this.database = database;
    }

    /**
     * Stores as many units as the shop's storage allows, in a single transaction. The depositor is
     * the owner or an employee. Nothing is stored unless the listing still belongs to an approved
     * shop, accepts the same sample (EXACT listings) and still has the
     * item key and unit amount the items were validated against. The first {@code stored} units
     * of the list are the ones saved; the caller returns the rest.
     */
    /** The listing still accepts what the items were validated against (key, unit, EXACT sample). */
    private static boolean sameListing(ResultSet row, String itemKey, int unitAmount, @Nullable byte[] exactSample)
            throws SQLException {
        byte[] currentSample = "EXACT".equals(row.getString("match_mode")) ? row.getBytes("sample") : null;
        return row.getString("item_key").equals(itemKey)
                && row.getInt("unit_amount") == unitAmount
                && Arrays.equals(currentSample, exactSample);
    }

    public DepositResult deposit(UUID listingId, UUID depositorId, String itemKey, int unitAmount,
                                 @Nullable byte[] exactSample, List<byte[]> units) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                UUID shopId;
                try (PreparedStatement lock = connection.prepareStatement(LOCK_LISTING)) {
                    lock.setObject(1, listingId);
                    lock.setObject(2, depositorId);
                    try (ResultSet row = lock.executeQuery()) {
                        if (!row.next() || !sameListing(row, itemKey, unitAmount, exactSample)) {
                            connection.rollback();
                            return DepositResult.invalidListing();
                        }
                        shopId = row.getObject("shop_id", UUID.class);
                    }
                }

                int capacity;
                int used;
                try (PreparedStatement storage = connection.prepareStatement(STORAGE)) {
                    storage.setObject(1, shopId);
                    storage.setObject(2, shopId);
                    try (ResultSet row = storage.executeQuery()) {
                        row.next();
                        capacity = row.getInt("capacity");
                        used = row.getInt("used");
                    }
                }

                int toStore = Math.min(units.size(), Math.max(0, capacity - used));
                if (toStore > 0) {
                    try (PreparedStatement insert = connection.prepareStatement(INSERT_UNIT)) {
                        for (byte[] unit : units.subList(0, toStore)) {
                            insert.setObject(1, listingId);
                            insert.setBytes(2, unit);
                            insert.addBatch();
                        }
                        insert.executeBatch();
                    }
                }
                connection.commit();
                return new DepositResult(true, toStore, used, capacity);
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }
}
