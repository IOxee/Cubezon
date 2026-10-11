package es.fractalgamestudios.cubezon.database;

import es.fractalgamestudios.cubezon.locker.BlockPosition;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** public.kiosks: the «Tienda Cubezon» blocks admins register in the game. */
public final class KioskRepository {

    private static final String FIND_ALL = "select world, x, y, z from public.kiosks";

    private static final String INSERT = """
            insert into public.kiosks (world, x, y, z, created_by) values (?, ?, ?, ?, ?)
            on conflict (world, x, y, z) do nothing
            """;

    private static final String DELETE = "delete from public.kiosks where world = ? and x = ? and y = ? and z = ?";

    private final Database database;

    public KioskRepository(Database database) {
        this.database = database;
    }

    public List<BlockPosition> findAll() throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(FIND_ALL);
             ResultSet rows = statement.executeQuery()) {
            List<BlockPosition> kiosks = new ArrayList<>();
            while (rows.next()) {
                kiosks.add(new BlockPosition(rows.getString("world"), rows.getInt("x"), rows.getInt("y"), rows.getInt("z")));
            }
            return kiosks;
        }
    }

    /** @return false if that block already was a kiosk */
    public boolean create(BlockPosition position, UUID createdBy) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(INSERT)) {
            bind(statement, position);
            statement.setObject(5, createdBy);
            return statement.executeUpdate() > 0;
        }
    }

    /** @return false if that block was not a kiosk */
    public boolean remove(BlockPosition position) throws SQLException {
        try (Connection connection = database.connection();
             PreparedStatement statement = connection.prepareStatement(DELETE)) {
            bind(statement, position);
            return statement.executeUpdate() > 0;
        }
    }

    private static void bind(PreparedStatement statement, BlockPosition position) throws SQLException {
        statement.setString(1, position.world());
        statement.setInt(2, position.x());
        statement.setInt(3, position.y());
        statement.setInt(4, position.z());
    }
}
