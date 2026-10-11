package es.fractalgamestudios.cubezon.kiosk;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.database.KioskRepository;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import es.fractalgamestudios.cubezon.storage.StorageController;
import es.fractalgamestudios.cubezon.storage.StorageType;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;

import java.sql.SQLException;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.logging.Level;

/**
 * «Tienda Cubezon» kiosks: an admin turns the block they look at into one (/cz kiosk create) and
 * players right click it to buy storage blocks, company computers and mailboxes with game money.
 * Every purchase goes through the same code as /cz storage|computer|mailbox buy (config.yml prices
 * and buy.enabled) and needs the same cubezon.buy.* permission.
 */
public final class KioskController {

    private final CubezonPlugin plugin;
    private final KioskRegistry registry;

    public KioskController(CubezonPlugin plugin, KioskRegistry registry) {
        this.plugin = plugin;
        this.registry = registry;
    }

    public KioskRegistry registry() {
        return registry;
    }

    public void refresh() {
        KioskRepository kiosks = plugin.kiosks();
        if (kiosks == null) {
            registry.replaceAll(List.of());
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                registry.replaceAll(kiosks.findAll());
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not refresh kiosks", e);
            }
        });
    }

    public void create(Player player) {
        BlockPosition position = targetOf(player);
        KioskRepository kiosks = requireDatabase(player);
        if (position == null || kiosks == null) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                boolean created = kiosks.create(position, player.getUniqueId());
                if (created) {
                    registry.add(position);
                }
                player.sendMessage(plugin.messages().get(created ? "kiosk.created" : "kiosk.exists", tags(position)));
            } catch (SQLException e) {
                fail(player, "Could not create a kiosk at " + position, e);
            }
        });
    }

    public void remove(Player player) {
        BlockPosition position = targetOf(player);
        KioskRepository kiosks = requireDatabase(player);
        if (position == null || kiosks == null) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                boolean removed = kiosks.remove(position);
                registry.remove(position);
                player.sendMessage(plugin.messages().get(removed ? "kiosk.removed" : "kiosk.not-found", tags(position)));
            } catch (SQLException e) {
                fail(player, "Could not remove the kiosk at " + position, e);
            }
        });
    }

    public void list(CommandSender sender) {
        Messages messages = plugin.messages();
        List<BlockPosition> all = registry.all();
        if (all.isEmpty()) {
            sender.sendMessage(messages.get("kiosk.list-empty"));
            return;
        }
        sender.sendMessage(messages.get("kiosk.list-header", Placeholder.unparsed("count", String.valueOf(all.size()))));
        all.forEach(position -> sender.sendMessage(messages.plain("kiosk.list-entry", tags(position))));
    }

    /** Main thread. The kiosk menu: one button per thing the player may buy. */
    public void open(Player player) {
        Messages messages = plugin.messages();
        MenuLayout menu = plugin.menuLayout();
        Gui gui = new Gui(plugin.getServer(), 4, messages.plain("kiosk.title"));
        gui.set(menu.slot("kiosk.info", 4), Icons.decorate(menu.icon("kiosk.info", Material.EMERALD), messages,
                "kiosk.info", List.of("kiosk.info-hint")));
        StorageController storage = plugin.storageController();
        if (Perm.BUY_STORAGE.has(player)) {
            int slot = menu.slot("kiosk.storage-start", 9);
            for (StorageType type : storage.types()) {
                if (!type.buyable() || slot > 17) {
                    continue;
                }
                gui.set(slot++, Icons.of(type.material(), messages, "panel.storage.type",
                                List.of("panel.storage.type-capacity", "panel.storage.type-price", "panel.storage.type-hint"),
                                storage.typeTags(type)),
                        buying((p, amount) -> storage.buy(p, type.id(), amount)));
            }
        }
        if (Perm.BUY_COMPUTER.has(player)) {
            gui.set(menu.slot("kiosk.computer", 21), Icons.decorate(menu.icon("kiosk.computer",
                            plugin.roleplayController().items().computerBlock()), messages, "kiosk.computer",
                            List.of("kiosk.price", "panel.storage.buy-hint"), price("computer.buy.price")),
                    buying((p, amount) -> plugin.roleplayController().buy(p, amount)));
        }
        if (Perm.BUY_MAILBOX.has(player)) {
            gui.set(menu.slot("kiosk.mailbox", 23), Icons.decorate(menu.icon("kiosk.mailbox",
                            plugin.mailboxController().blockMaterial()), messages, "kiosk.mailbox",
                            List.of("kiosk.price", "panel.storage.buy-hint"), price("mailbox.buy.price")),
                    buying((p, amount) -> plugin.mailboxController().buy(p, amount)));
        }
        gui.set(menu.slot("kiosk.close", 31), Icons.decorate(menu.icon("kiosk.close", Material.BARRIER), messages,
                "panel.close", List.of()), (p, click) -> p.closeInventory());
        gui.fill(menu.filler()).open(player);
    }

    /** Left click buys one; right click asks how many in chat. */
    private Gui.Action buying(BiConsumer<Player, Integer> buy) {
        return (player, click) -> {
            if (click == ClickType.RIGHT || click == ClickType.SHIFT_RIGHT) {
                int max = Math.clamp(plugin.getConfig().getInt("settings.max-purchase-amount", StorageController.MAX_AMOUNT),
                        1, StorageController.MAX_AMOUNT);
                plugin.chatPrompt().askAmount(player, "prompt.buy", max, amount -> buy.accept(player, amount));
            } else {
                buy.accept(player, 1);
            }
        };
    }

    private TagResolver price(String path) {
        double price = plugin.getConfig().getDouble(path, 0);
        Economy economy = plugin.economy();
        return Placeholder.unparsed("price", economy == null ? String.valueOf(price) : economy.format(price));
    }

    /** The block the player looks at, within reach; null (and told) if none. */
    private BlockPosition targetOf(Player player) {
        int reach = Math.clamp(plugin.getConfig().getInt("settings.locker-reach", 5), 1, 32);
        Block block = player.getTargetBlockExact(reach);
        if (block == null || block.isEmpty()) {
            player.sendMessage(plugin.messages().get("kiosk.look-at-block",
                    Placeholder.unparsed("radius", String.valueOf(reach))));
            return null;
        }
        return BlockPosition.of(block);
    }

    private KioskRepository requireDatabase(CommandSender sender) {
        KioskRepository kiosks = plugin.kiosks();
        if (kiosks == null) {
            sender.sendMessage(plugin.messages().get("error.database-required"));
        }
        return kiosks;
    }

    private void fail(CommandSender sender, String logMessage, SQLException e) {
        plugin.getLogger().log(Level.WARNING, logMessage, e);
        sender.sendMessage(plugin.messages().get("kiosk.failed"));
    }

    private static TagResolver tags(BlockPosition position) {
        return TagResolver.resolver(
                Placeholder.unparsed("world", position.world()),
                Placeholder.unparsed("x", String.valueOf(position.x())),
                Placeholder.unparsed("y", String.valueOf(position.y())),
                Placeholder.unparsed("z", String.valueOf(position.z())));
    }
}
