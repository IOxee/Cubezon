package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.order.CourierCommission;
import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Data behind the company computer panel: the shop, its staff, its listings and their stock.
 * Owner-only actions (staff changes, withdrawing stock, samples) check the owner in SQL; admins
 * pass {@code admin = true}.
 */
public final class ShopPanelRepository {

    public record ShopInfo(UUID id, String name, String slug, String status, UUID ownerId, String ownerName,
                           boolean hasZone, int storageBlocks, int usedUnits, int capacityUnits, int members,
                           CourierCommission commission) {
    }

    public record Member(UUID id, String name, @Nullable UUID roleId, @Nullable String roleName) {
    }

    public enum HireResult { ADDED, ALREADY, MEMBERSHIP_LIMIT }

    public record PanelListing(UUID id, String title, String itemKey, String material, int unitAmount,
                               BigDecimal unitPrice, String status, String matchMode, @Nullable byte[] sample,
                               int available, int reserved) {

        public boolean exact() {
            return "EXACT".equals(matchMode);
        }
    }

    private static final String SHOP_INFO = """
            select s.id, s.name, s.slug, s.status::text as status, s.owner_uuid, p.name as owner_name,
                   s.zone_world is not null as has_zone,
                   st.storage_blocks, st.used_units, st.capacity_units,
                   (select count(*) from public.shop_members m where m.shop_id = s.id) as members,
                   s.courier_commission_mode, s.courier_commission_value
            from public.shops s
            join public.players p on p.uuid = s.owner_uuid
            join public.shop_storage st on st.shop_id = s.id
            where s.id = ?
            """;

    private static final String MEMBERS = """
            select p.uuid, p.name, m.role_id, r.name as role_name
            from public.shop_members m
            join public.players p on p.uuid = m.player_uuid
            left join public.shop_roles r on r.id = m.role_id
            where m.shop_id = ? order by r.position nulls last, p.name
            """;

    private static final String IS_OWNER = "select owner_uuid = ? from public.shops where id = ?";

    /** Only the owner (or an admin) decides what couriers earn. */
    private static final String SET_COURIER_COMMISSION = """
            update public.shops set courier_commission_mode = ?, courier_commission_value = ?
            where id = ? and (owner_uuid = ? or ?)
            """;

    private static final String ADD_MEMBER = """
            insert into public.shop_members (shop_id, player_uuid, added_by)
            select s.id, ?, ? from public.shops s
            where s.id = ? and s.owner_uuid <> ? and (public.shop_member_can(s.id, ?, 'staff.manage') or ?)
            on conflict do nothing
            """;

    /** staff.manage fires employees, but only the owner (or an admin) fires someone who has staff.manage. */
    private static final String REMOVE_MEMBER = """
            delete from public.shop_members m
            where m.shop_id = ? and m.player_uuid = ?
              and (? or exists (select 1 from public.shops s where s.id = m.shop_id and s.owner_uuid = ?)
                   or (public.shop_member_can(m.shop_id, ?, 'staff.manage')
                       and not public.shop_member_can(m.shop_id, m.player_uuid, 'staff.manage')))
            """;

    private static final String LISTINGS = """
            select l.id, l.title, l.item_key, l.material, l.unit_amount, l.unit_price, l.status::text as status,
                   l.match_mode, l.sample,
                   count(e.id) filter (where e.status = 'AVAILABLE') as available,
                   count(e.id) filter (where e.status = 'RESERVED') as reserved
            from public.listings l
            left join public.escrow_items e on e.listing_id = l.id
            where l.shop_id = ? and l.status <> 'REMOVED'
            group by l.id
            order by l.created_at
            limit ?
            """;

    /** Takes back unsold units: marked RETURNED first, handed over after (never duplicated). */
    private static final String WITHDRAW = """
            with units as (
                select e.id from public.escrow_items e
                join public.listings l on l.id = e.listing_id
                join public.shops s on s.id = l.shop_id
                where e.listing_id = ? and l.shop_id = ? and e.status = 'AVAILABLE'
                  and (public.shop_member_can(s.id, ?, 'stock.withdraw') or ?)
                order by e.deposited_at desc
                limit ?
                for update of e skip locked
            )
            update public.escrow_items e set status = 'RETURNED', returned_at = now()
            from units where e.id = units.id
            returning e.item_data
            """;

    private static final String SET_SAMPLE = """
            update public.listings l
            set match_mode = ?, sample = ?, sample_set_at = case when ?::bytea is null then null else now() end
            from public.shops s
            where l.id = ? and l.shop_id = ? and s.id = l.shop_id and (public.shop_member_can(s.id, ?, 'products.manage') or ?)
            """;

    /** A product sold from the game: same columns the web fills. Only the owner (or an admin), only approved shops. */
    private static final String CREATE_LISTING = """
            insert into public.listings (shop_id, title, material, item_key, unit_amount, unit_price)
            select s.id, ?, ?, ?, ?, ? from public.shops s
            where s.id = ? and s.status = 'APPROVED' and (public.shop_member_can(s.id, ?, 'products.manage') or ?)
            returning id
            """;

    private static final String OWNED_LISTING = """
            from public.shops s
            where l.id = ? and l.shop_id = ? and s.id = l.shop_id and (public.shop_member_can(s.id, ?, 'products.manage') or ?) and l.status <> 'REMOVED'
            """;

    private static final String SET_PRICE = "update public.listings l set unit_price = ? " + OWNED_LISTING;

    private static final String SET_TITLE = "update public.listings l set title = ? " + OWNED_LISTING;

    private static final String SET_STATUS = "update public.listings l set status = ?::public.listing_status " + OWNED_LISTING;

    /** A product is only taken off sale once nothing of it is stored or reserved for an order. */
    private static final String REMOVE_LISTING = "update public.listings l set status = 'REMOVED' " + OWNED_LISTING + """
              and not exists (select 1 from public.escrow_items e
                              where e.listing_id = l.id and e.status in ('AVAILABLE', 'RESERVED'))
            """;

    private final Database database;

    public ShopPanelRepository(Database database) {
        this.database = database;
    }

    public Optional<ShopInfo> shopInfo(UUID shopId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(SHOP_INFO)) {
            statement.setObject(1, shopId);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    return Optional.empty();
                }
                return Optional.of(new ShopInfo(row.getObject("id", UUID.class), row.getString("name"),
                        row.getString("slug"), row.getString("status"), row.getObject("owner_uuid", UUID.class),
                        row.getString("owner_name"), row.getBoolean("has_zone"), row.getInt("storage_blocks"),
                        row.getInt("used_units"), row.getInt("capacity_units"), row.getInt("members"),
                        CourierCommission.of(row.getString("courier_commission_mode"),
                                row.getBigDecimal("courier_commission_value"))));
            }
        }
    }

    /** False when the requester is not the owner (nor an admin) or the shop is gone. */
    public boolean setCourierCommission(UUID shopId, UUID requesterId, boolean admin, CourierCommission commission)
            throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(SET_COURIER_COMMISSION)) {
            statement.setString(1, commission.mode().name());
            statement.setBigDecimal(2, commission.value());
            statement.setObject(3, shopId);
            statement.setObject(4, requesterId);
            statement.setBoolean(5, admin);
            return statement.executeUpdate() > 0;
        }
    }

    public List<Member> members(UUID shopId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(MEMBERS)) {
            statement.setObject(1, shopId);
            List<Member> members = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    members.add(new Member(rows.getObject("uuid", UUID.class), rows.getString("name"),
                            rows.getObject("role_id", UUID.class), rows.getString("role_name")));
                }
            }
            return members;
        }
    }

    public boolean isOwner(UUID shopId, UUID playerId) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(IS_OWNER)) {
            statement.setObject(1, playerId);
            statement.setObject(2, shopId);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() && row.getBoolean(1);
            }
        }
    }

    /**
     * The caller checked the requester is the owner or an admin. The owner cannot hire themself, and
     * nobody can work in more shops than the global limit (enforced by the database).
     */
    public HireResult addMember(UUID shopId, UUID playerId, UUID addedBy, boolean admin) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(ADD_MEMBER)) {
            statement.setObject(1, playerId);
            statement.setObject(2, addedBy);
            statement.setObject(3, shopId);
            statement.setObject(4, playerId);
            statement.setObject(5, addedBy);
            statement.setBoolean(6, admin);
            return statement.executeUpdate() > 0 ? HireResult.ADDED : HireResult.ALREADY;
        } catch (SQLException e) {
            if (RoleplayRepository.isMembershipLimit(e)) {
                return HireResult.MEMBERSHIP_LIMIT;
            }
            throw e;
        }
    }

    public boolean removeMember(UUID shopId, UUID playerId, UUID requesterId, boolean admin) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(REMOVE_MEMBER)) {
            statement.setObject(1, shopId);
            statement.setObject(2, playerId);
            statement.setBoolean(3, admin);
            statement.setObject(4, requesterId);
            statement.setObject(5, requesterId);
            return statement.executeUpdate() > 0;
        }
    }

    public List<PanelListing> listings(UUID shopId, int limit) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(LISTINGS)) {
            statement.setObject(1, shopId);
            statement.setInt(2, limit);
            List<PanelListing> listings = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    listings.add(new PanelListing(rows.getObject("id", UUID.class), rows.getString("title"),
                            rows.getString("item_key"), rows.getString("material"), rows.getInt("unit_amount"),
                            rows.getBigDecimal("unit_price"), rows.getString("status"), rows.getString("match_mode"),
                            rows.getBytes("sample"), rows.getInt("available"), rows.getInt("reserved")));
                }
            }
            return listings;
        }
    }

    /** @return the withdrawn units (possibly fewer than asked, or none if not the owner) */
    public List<byte[]> withdraw(UUID listingId, UUID shopId, UUID requesterId, boolean admin, int count)
            throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(WITHDRAW)) {
            statement.setObject(1, listingId);
            statement.setObject(2, shopId);
            statement.setObject(3, requesterId);
            statement.setBoolean(4, admin);
            statement.setInt(5, count);
            List<byte[]> units = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    units.add(rows.getBytes(1));
                }
            }
            return units;
        }
    }

    /** @return the new product id, or empty if the requester may not create products in that shop */
    public Optional<UUID> createListing(UUID shopId, UUID requesterId, boolean admin, String title, String material,
                                        String itemKey, int unitAmount, BigDecimal price) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(CREATE_LISTING)) {
            statement.setString(1, title);
            statement.setString(2, material);
            statement.setString(3, itemKey);
            statement.setInt(4, unitAmount);
            statement.setBigDecimal(5, price);
            statement.setObject(6, shopId);
            statement.setObject(7, requesterId);
            statement.setBoolean(8, admin);
            try (ResultSet row = statement.executeQuery()) {
                return row.next() ? Optional.of(row.getObject("id", UUID.class)) : Optional.empty();
            }
        }
    }

    public boolean setPrice(UUID listingId, UUID shopId, UUID requesterId, boolean admin, BigDecimal price) throws SQLException {
        return updateOwned(SET_PRICE, listingId, shopId, requesterId, admin, statement -> statement.setBigDecimal(1, price));
    }

    public boolean setTitle(UUID listingId, UUID shopId, UUID requesterId, boolean admin, String title) throws SQLException {
        return updateOwned(SET_TITLE, listingId, shopId, requesterId, admin, statement -> statement.setString(1, title));
    }

    /** {@code active} false pauses the product (it stays in the shop but cannot be bought). */
    public boolean setActive(UUID listingId, UUID shopId, UUID requesterId, boolean admin, boolean active) throws SQLException {
        return updateOwned(SET_STATUS, listingId, shopId, requesterId, admin,
                statement -> statement.setString(1, active ? "ACTIVE" : "PAUSED"));
    }

    /** @return false if the product still has stock or reserved units (or the requester may not) */
    public boolean removeListing(UUID listingId, UUID shopId, UUID requesterId, boolean admin) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(REMOVE_LISTING)) {
            statement.setObject(1, listingId);
            statement.setObject(2, shopId);
            statement.setObject(3, requesterId);
            statement.setBoolean(4, admin);
            return statement.executeUpdate() > 0;
        }
    }

    private interface FirstParameter {
        void set(PreparedStatement statement) throws SQLException;
    }

    private boolean updateOwned(String sql, UUID listingId, UUID shopId, UUID requesterId, boolean admin,
                                FirstParameter value) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            value.set(statement);
            statement.setObject(2, listingId);
            statement.setObject(3, shopId);
            statement.setObject(4, requesterId);
            statement.setBoolean(5, admin);
            return statement.executeUpdate() > 0;
        }
    }

    /** {@code sample} null sets the listing back to KEY matching. */
    public boolean setSample(UUID listingId, UUID shopId, UUID requesterId, boolean admin, @Nullable byte[] sample)
            throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(SET_SAMPLE)) {
            statement.setString(1, sample == null ? "KEY" : "EXACT");
            statement.setBytes(2, sample);
            statement.setBytes(3, sample);
            statement.setObject(4, listingId);
            statement.setObject(5, shopId);
            statement.setObject(6, requesterId);
            statement.setBoolean(7, admin);
            return statement.executeUpdate() > 0;
        }
    }
}
