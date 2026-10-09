package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.order.ClaimedOrder;
import es.fractalgamestudios.cubezon.order.FailureReason;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * public.orders as processed by the plugin. Every method is one transaction; Vault is never
 * called from here (the caller charges on the main thread between claim and finish).
 */
public final class OrderRepository {

    /** What claiming the next order produced. */
    public sealed interface ClaimResult {
        /** No PENDING order left to process. */
        record None() implements ClaimResult {
        }

        /** The order was failed during the claim (nothing was charged). */
        record Failed(ClaimedOrder order, FailureReason reason) implements ClaimResult {
        }

        /** Units reserved: the order is ready to be charged. */
        record Claimed(ClaimedOrder order) implements ClaimResult {
        }
    }

    /** An order the plugin stopped processing halfway (see recoverInterrupted). */
    public record InterruptedOrder(UUID orderId, UUID buyerId, BigDecimal total) {
    }

    /**
     * Oldest PENDING order not yet claimed, with what processing needs. SKIP LOCKED so a slow
     * transaction never blocks the queue.
     */
    private static final String SELECT_NEXT = """
            select o.id, o.buyer_uuid, o.listing_id, o.shop_id, o.locker_id, o.quantity, o.total,
                   s.owner_uuid as seller_uuid, s.status::text as shop_status, s.name as shop_name,
                   l.title, l.status::text as listing_status,
                   coalesce(k.name, '') as locker_name, coalesce(k.active, false) as locker_active,
                   o.delivery_method, o.express_fee, o.mailbox_id, b.id is not null as mailbox_exists
            from public.orders o
            join public.shops s on s.id = o.shop_id
            join public.listings l on l.id = o.listing_id
            left join public.lockers k on k.id = o.locker_id
            left join public.mailboxes b on b.id = o.mailbox_id
            where o.status = 'PENDING' and o.processing_started_at is null
            order by o.created_at
            limit 1
            for update of o skip locked
            """;

    /** Same as SELECT_NEXT, for one order of one shop (roleplay: the shop accepts it). */
    private static final String SELECT_BY_ID = """
            select o.id, o.buyer_uuid, o.listing_id, o.shop_id, o.locker_id, o.quantity, o.total,
                   s.owner_uuid as seller_uuid, s.status::text as shop_status, s.name as shop_name,
                   l.title, l.status::text as listing_status,
                   coalesce(k.name, '') as locker_name, coalesce(k.active, false) as locker_active,
                   o.delivery_method, o.express_fee, o.mailbox_id, b.id is not null as mailbox_exists
            from public.orders o
            join public.shops s on s.id = o.shop_id
            join public.listings l on l.id = o.listing_id
            left join public.lockers k on k.id = o.locker_id
            left join public.mailboxes b on b.id = o.mailbox_id
            where o.id = ? and o.shop_id = ? and o.status = 'PENDING' and o.processing_started_at is null
            for update of o skip locked
            """;

    private static final String SELECT_UNITS = """
            select id, item_data from public.escrow_items
            where listing_id = ? and status = 'AVAILABLE'
            order by deposited_at, id
            limit ?
            for update skip locked
            """;

    private static final String RESERVE_UNIT = """
            update public.escrow_items set status = 'RESERVED', order_id = ? where id = ?
            """;

    private static final String MARK_CLAIMED = """
            update public.orders set processing_started_at = now() where id = ?
            """;

    private static final String FAIL_ORDER = """
            update public.orders set status = ?::public.order_status, failure_reason = ? where id = ?
            """;

    private static final String RELEASE_UNITS = """
            update public.escrow_items set status = 'AVAILABLE', order_id = null
            where order_id = ? and status = 'RESERVED'
            """;

    /** Automatic mode: buyer charged and seller paid at once. Two updates so order_events records both transitions. */
    private static final String MARK_PAID = """
            update public.orders set status = 'PAID', paid_at = now(), seller_paid_at = now()
            where id = ? and status = 'PENDING' and processing_started_at is not null
            """;

    /** Roleplay accept: buyer charged, money held until delivery (seller_paid_at stays null). */
    private static final String MARK_ACCEPTED = """
            update public.orders set status = 'PAID', paid_at = now()
            where id = ? and status = 'PENDING' and processing_started_at is not null
            """;

    private static final String REJECT = """
            update public.orders set status = 'FAILED', failure_reason = 'SHOP_REJECTED'
            where id = ? and shop_id = ? and status = 'PENDING' and processing_started_at is null
            """;

    /**
     * Roleplay delivery: only a PAID order, only at its own locker. The seller payout is claimed
     * (seller_paid_at) in the same statement, before the money moves.
     */
    private static final String DELIVER = """
            update public.orders o set status = 'READY', ready_at = now(), seller_paid_at = now()
            from public.shops s, public.listings l
            where o.id = ? and o.locker_id = ? and o.status = 'PAID'
              and s.id = o.shop_id and l.id = o.listing_id
            returning o.id, o.buyer_uuid, s.owner_uuid as seller_uuid, o.listing_id, l.title,
                      s.name as shop_name, o.quantity, o.total, o.express_fee, o.mailbox_id
            """;

    private static final String CLEAR_PAYOUT = "update public.orders set seller_paid_at = null where id = ?";

    /** Payouts a failed deposit left pending; claimed before paying, like DELIVER. */
    private static final String CLAIM_PAYOUTS = """
            update public.orders o set seller_paid_at = now()
            from public.shops s, public.listings l
            where s.id = o.shop_id and l.id = o.listing_id
              and o.status in ('READY', 'COLLECTED') and o.seller_paid_at is null and o.paid_at is not null
            returning o.id, o.buyer_uuid, s.owner_uuid as seller_uuid, o.listing_id, l.title,
                      s.name as shop_name, o.quantity, o.total, o.express_fee, o.mailbox_id
            """;

    private static final String EXPIRE_PENDING = """
            update public.orders o set status = 'FAILED', failure_reason = 'EXPIRED'
            from public.shops s, public.listings l
            where s.id = o.shop_id and l.id = o.listing_id
              and o.status = 'PENDING' and o.processing_started_at is null
              and o.created_at < now() - ? * interval '1 hour'
            returning o.id, o.buyer_uuid, s.owner_uuid as seller_uuid, o.listing_id, l.title,
                      s.name as shop_name, o.quantity, o.total, o.express_fee, o.mailbox_id
            """;

    private static final String SELECT_EXPIRED_ACCEPTED = """
            select o.id, o.buyer_uuid, s.owner_uuid as seller_uuid, o.listing_id, l.title,
                   s.name as shop_name, o.quantity, o.total, o.express_fee, o.mailbox_id
            from public.orders o
            join public.shops s on s.id = o.shop_id
            join public.listings l on l.id = o.listing_id
            where o.status = 'PAID' and o.paid_at < now() - ? * interval '1 hour'
            for update of o skip locked
            """;

    private static final String MARK_READY = """
            update public.orders set status = 'READY', ready_at = now() where id = ? and status = 'PAID'
            """;

    private static final String SELECT_INTERRUPTED = """
            select id, buyer_uuid, total from public.orders
            where status = 'PENDING' and processing_started_at is not null
            for update
            """;

    private final Database database;

    public OrderRepository(Database database) {
        this.database = database;
    }

    /**
     * Claims the next PENDING order: checks shop, listing and locker, reserves {@code quantity}
     * AVAILABLE units and checks each one with {@code validItem}. Anything wrong fails the order
     * in the same transaction, before any money moves.
     */
    public ClaimResult claimNext(Predicate<byte[]> validItem) throws SQLException {
        return claim(SELECT_NEXT, statement -> { }, validItem);
    }

    /** Roleplay: the shop accepts one of its PENDING orders. Same checks and reservation as claimNext. */
    public ClaimResult claimById(UUID orderId, UUID shopId, Predicate<byte[]> validItem) throws SQLException {
        return claim(SELECT_BY_ID, statement -> {
            statement.setObject(1, orderId);
            statement.setObject(2, shopId);
        }, validItem);
    }

    private interface Binder {
        void bind(PreparedStatement statement) throws SQLException;
    }

    private ClaimResult claim(String selectSql, Binder binder, Predicate<byte[]> validItem) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                ClaimedOrder order;
                String shopStatus;
                String listingStatus;
                boolean lockerActive;
                boolean toMailbox;
                boolean mailboxExists;
                try (PreparedStatement select = connection.prepareStatement(selectSql)) {
                    binder.bind(select);
                    try (ResultSet row = select.executeQuery()) {
                        if (!row.next()) {
                            connection.rollback();
                            return new ClaimResult.None();
                        }
                        order = new ClaimedOrder(
                                row.getObject("id", UUID.class),
                                row.getObject("buyer_uuid", UUID.class),
                                row.getObject("seller_uuid", UUID.class),
                                row.getObject("listing_id", UUID.class),
                                row.getString("title"),
                                row.getString("shop_name"),
                                row.getString("locker_name"),
                                row.getInt("quantity"),
                                row.getBigDecimal("total"),
                                row.getBigDecimal("express_fee"),
                                row.getObject("mailbox_id", UUID.class));
                        shopStatus = row.getString("shop_status");
                        listingStatus = row.getString("listing_status");
                        lockerActive = row.getBoolean("locker_active");
                        toMailbox = "MAILBOX".equals(row.getString("delivery_method"));
                        mailboxExists = row.getBoolean("mailbox_exists");
                    }
                }

                markClaimed(connection, order.id());
                if (!"APPROVED".equals(shopStatus) || !"ACTIVE".equals(listingStatus)) {
                    return failInClaim(connection, order, FailureReason.LISTING_UNAVAILABLE);
                }
                if (toMailbox && !mailboxExists) {
                    return failInClaim(connection, order, FailureReason.MAILBOX_UNAVAILABLE);
                }
                if (!toMailbox && !lockerActive) {
                    return failInClaim(connection, order, FailureReason.LOCKER_UNAVAILABLE);
                }

                List<UUID> unitIds = new ArrayList<>();
                try (PreparedStatement units = connection.prepareStatement(SELECT_UNITS)) {
                    units.setObject(1, order.listingId());
                    units.setInt(2, order.quantity());
                    try (ResultSet rows = units.executeQuery()) {
                        while (rows.next()) {
                            if (!validItem.test(rows.getBytes("item_data"))) {
                                return failInClaim(connection, order, FailureReason.INVALID_ITEM);
                            }
                            unitIds.add(rows.getObject("id", UUID.class));
                        }
                    }
                }
                if (unitIds.size() < order.quantity()) {
                    return failInClaim(connection, order, FailureReason.OUT_OF_STOCK);
                }

                try (PreparedStatement reserve = connection.prepareStatement(RESERVE_UNIT)) {
                    for (UUID unitId : unitIds) {
                        reserve.setObject(1, order.id());
                        reserve.setObject(2, unitId);
                        reserve.addBatch();
                    }
                    reserve.executeBatch();
                }
                connection.commit();
                return new ClaimResult.Claimed(order);
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    /** After a successful charge: PENDING → PAID → READY. Units stay RESERVED until pickup. */
    public boolean finish(UUID orderId) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                int paid;
                try (PreparedStatement update = connection.prepareStatement(MARK_PAID)) {
                    update.setObject(1, orderId);
                    paid = update.executeUpdate();
                }
                if (paid == 0) {
                    connection.rollback();
                    return false;
                }
                try (PreparedStatement update = connection.prepareStatement(MARK_READY)) {
                    update.setObject(1, orderId);
                    update.executeUpdate();
                }
                connection.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    /** Fails (or refunds) a claimed order and puts its units back on sale. */
    public void fail(UUID orderId, FailureReason reason) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                failAndRelease(connection, orderId, reason);
                connection.commit();
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    /** Roleplay accept, after charging the buyer: PENDING -> PAID. Units stay RESERVED. */
    public boolean markAccepted(UUID orderId) throws SQLException {
        return update(MARK_ACCEPTED, orderId) > 0;
    }

    /**
     * Roleplay accept of an express order: there is no courier, so PENDING -> PAID -> READY at once,
     * and the seller payout is claimed (seller_paid_at) before the money moves, as on delivery.
     */
    public boolean acceptIntoMailbox(UUID orderId) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                int paid;
                try (PreparedStatement update = connection.prepareStatement(MARK_ACCEPTED)) {
                    update.setObject(1, orderId);
                    paid = update.executeUpdate();
                }
                if (paid == 0) {
                    connection.rollback();
                    return false;
                }
                try (PreparedStatement update = connection.prepareStatement(
                        "update public.orders set status = 'READY', ready_at = now(), seller_paid_at = now() where id = ? and status = 'PAID'")) {
                    update.setObject(1, orderId);
                    update.executeUpdate();
                }
                connection.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    /** Roleplay reject: only a PENDING order of that shop nobody is accepting right now. */
    public boolean reject(UUID orderId, UUID shopId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(REJECT)) {
            statement.setObject(1, orderId);
            statement.setObject(2, shopId);
            return statement.executeUpdate() > 0;
        }
    }

    /**
     * Roleplay delivery of a package at a locker: PAID -> READY, payout claimed. Empty if the
     * order is not PAID or belongs to another locker.
     */
    public Optional<ClaimedOrder> deliver(UUID orderId, UUID lockerId, String lockerName) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(DELIVER)) {
            statement.setObject(1, orderId);
            statement.setObject(2, lockerId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() ? Optional.of(readOrder(row, lockerName)) : Optional.empty();
            }
        }
    }

    /** The payout failed: forget the claim so it is retried. */
    public void clearPayout(UUID orderId) throws SQLException {
        update(CLEAR_PAYOUT, orderId);
    }

    /** Claims every payout left pending by a failed deposit. The caller pays each seller. */
    public List<ClaimedOrder> claimPendingPayouts() throws SQLException {
        return returningOrders(CLAIM_PAYOUTS, null);
    }

    /** Roleplay: PENDING orders nobody accepted in time -> FAILED / EXPIRED (nothing was charged). */
    public List<ClaimedOrder> expirePending(int hours) throws SQLException {
        return returningOrders(EXPIRE_PENDING, hours);
    }

    /**
     * Roleplay: accepted orders never delivered in time -> REFUNDED / DELIVERY_EXPIRED, units back
     * on sale. Marked first, refunded after by the caller (a crash can underpay, never pay twice).
     */
    public List<ClaimedOrder> expireAccepted(int hours) throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                List<ClaimedOrder> expired = new ArrayList<>();
                try (PreparedStatement select = connection.prepareStatement(SELECT_EXPIRED_ACCEPTED)) {
                    select.setInt(1, hours);
                    try (ResultSet rows = select.executeQuery()) {
                        while (rows.next()) {
                            expired.add(readOrder(rows, ""));
                        }
                    }
                }
                for (ClaimedOrder order : expired) {
                    failAndRelease(connection, order.id(), FailureReason.DELIVERY_EXPIRED);
                }
                connection.commit();
                return expired;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    private List<ClaimedOrder> returningOrders(String sql, Integer hours) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            if (hours != null) {
                statement.setInt(1, hours);
            }
            List<ClaimedOrder> orders = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    orders.add(readOrder(rows, ""));
                }
            }
            return orders;
        }
    }

    private int update(String sql, UUID orderId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, orderId);
            return statement.executeUpdate();
        }
    }

    private static ClaimedOrder readOrder(ResultSet row, String lockerName) throws SQLException {
        return new ClaimedOrder(
                row.getObject("id", UUID.class),
                row.getObject("buyer_uuid", UUID.class),
                row.getObject("seller_uuid", UUID.class),
                row.getObject("listing_id", UUID.class),
                row.getString("title"),
                row.getString("shop_name"),
                lockerName,
                row.getInt("quantity"),
                row.getBigDecimal("total"),
                row.getBigDecimal("express_fee"),
                row.getObject("mailbox_id", UUID.class));
    }

    /**
     * Startup: orders claimed but never finished. They are failed with INTERRUPTED and their
     * units released; the caller logs them so an admin checks whether the buyer was charged.
     */
    public List<InterruptedOrder> recoverInterrupted() throws SQLException {
        try (Connection connection = database.connection()) {
            connection.setAutoCommit(false);
            try {
                List<InterruptedOrder> interrupted = new ArrayList<>();
                try (PreparedStatement select = connection.prepareStatement(SELECT_INTERRUPTED);
                     ResultSet rows = select.executeQuery()) {
                    while (rows.next()) {
                        interrupted.add(new InterruptedOrder(rows.getObject("id", UUID.class),
                                rows.getObject("buyer_uuid", UUID.class), rows.getBigDecimal("total")));
                    }
                }
                for (InterruptedOrder order : interrupted) {
                    failAndRelease(connection, order.orderId(), FailureReason.INTERRUPTED);
                }
                connection.commit();
                return interrupted;
            } catch (SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            }
        }
    }

    private static void markClaimed(Connection connection, UUID orderId) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(MARK_CLAIMED)) {
            update.setObject(1, orderId);
            update.executeUpdate();
        }
    }

    private static ClaimResult failInClaim(Connection connection, ClaimedOrder order, FailureReason reason)
            throws SQLException {
        failAndRelease(connection, order.id(), reason);
        connection.commit();
        return new ClaimResult.Failed(order, reason);
    }

    private static void failAndRelease(Connection connection, UUID orderId, FailureReason reason) throws SQLException {
        try (PreparedStatement release = connection.prepareStatement(RELEASE_UNITS)) {
            release.setObject(1, orderId);
            release.executeUpdate();
        }
        try (PreparedStatement fail = connection.prepareStatement(FAIL_ORDER)) {
            fail.setString(1, reason.status());
            fail.setString(2, reason.name());
            fail.setObject(3, orderId);
            fail.executeUpdate();
        }
    }
}
