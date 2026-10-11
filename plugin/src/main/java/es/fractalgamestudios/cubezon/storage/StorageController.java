package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.StorageRepository;
import es.fractalgamestudios.cubezon.database.StorageTypeRepository;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.locker.BlockPosition;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.Container;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.inventory.ItemStack;
import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Storage blocks (of admin-defined types) and shop zones. A block placed inside its owner's shop
 * zone adds its type's capacity to that shop; the deposit refuses units beyond it. Every decision on
 * a block event is taken from the in-memory registry; the database is written afterwards, off the
 * main thread.
 */
public final class StorageController {

    /** Most items bought or given at once (handed over in several stacks). */
    public static final int MAX_AMOUNT = 256;

    private final CubezonPlugin plugin;
    private final StorageRegistry registry = new StorageRegistry();
    private final StorageItem item;
    private final ZoneWand wand;
    /** Corners marked so far with a zone wand, per admin. */
    private final Map<UUID, WandProgress> wandProgress = new ConcurrentHashMap<>();
    /** Blocks whose removal is in flight, so a double break cannot drop two items. */
    private final Set<UUID> breaking = ConcurrentHashMap.newKeySet();
    /** Recipe of the default type only (config.yml storage.recipe). */
    private final SpecialItemShop itemShop;
    private volatile Map<String, StorageType> types = Map.of(StorageType.DEFAULT_ID, StorageType.fallback());

    public StorageController(CubezonPlugin plugin) {
        this.plugin = plugin;
        this.item = new StorageItem(plugin);
        this.wand = new ZoneWand(plugin);
        this.itemShop = new SpecialItemShop(plugin, "storage", "storage", "storage_block",
                amount -> createItem(defaultType(), amount));
    }

    public ItemStack createItem(StorageType type, int amount) {
        return item.create(type, amount, plugin.messages());
    }

    public StorageType defaultType() {
        return types.getOrDefault(StorageType.DEFAULT_ID, StorageType.fallback());
    }

    public @Nullable StorageType type(String id) {
        return types.get(id);
    }

    /** In capacity order (cheapest first, usually). */
    public List<StorageType> types() {
        return List.copyOf(types.values());
    }

    /** (Re)registers the crafting recipe from config.yml. Main thread. */
    public void registerRecipe() {
        itemShop.registerRecipe();
    }

    public void unregisterRecipe() {
        itemShop.unregisterRecipe();
    }

    public void refresh() {
        StorageRepository storage = plugin.storage();
        if (storage == null) {
            registry.replaceAll(List.of(), List.of());
            return;
        }
        StorageTypeRepository typeRepository = plugin.storageTypes();
        plugin.dbExecutor().execute(() -> {
            try {
                registry.replaceAll(storage.findZones(), storage.findBlocks());
                if (typeRepository != null) {
                    setTypes(typeRepository.findAll());
                }
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not refresh storage blocks", e);
            }
        });
    }

    public StorageRegistry registry() {
        return registry;
    }

    public StorageItem item() {
        return item;
    }

    private record WandProgress(UUID shopId, @Nullable BlockPosition corner1, @Nullable BlockPosition corner2) {
    }

    /** /cz shop <slug or id>: gives a zone wand bound to that shop. Names are not unique, so not accepted. */
    public void startZone(Player player, String key) {
        Messages messages = plugin.messages();
        StorageRepository storage = requireDatabase(player);
        if (storage == null) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            StorageRepository.ShopRef shop;
            try {
                shop = storage.findShop(key).orElse(null);
            } catch (SQLException e) {
                fail(player, "Could not look up shop " + key, e);
                return;
            }
            if (shop == null) {
                player.sendMessage(messages.get("shop.not-found", Placeholder.unparsed("query", key)));
                return;
            }
            runOnMainThread(() -> {
                if (!player.isOnline()) {
                    return;
                }
                wandProgress.put(player.getUniqueId(), new WandProgress(shop.id(), null, null));
                giveOrDrop(player, wand.create(new ZoneWand.Target(shop.id(), shop.name()), messages));
                player.sendMessage(messages.get("shop.wand-given",
                        Placeholder.unparsed("shop", shop.name()), Placeholder.unparsed("slug", shop.slug())));
            });
        });
    }

    /** Slug suggestions for /cz shop; resolved off the main thread. */
    public CompletableFuture<List<String>> suggestSlugs(String prefix) {
        StorageRepository storage = plugin.storage();
        if (storage == null) {
            return CompletableFuture.completedFuture(List.of());
        }
        return CompletableFuture.supplyAsync(() -> {
            try {
                return storage.findSlugs(prefix);
            } catch (SQLException e) {
                return List.of();
            }
        }, plugin.dbExecutor());
    }

    public ZoneWand wand() {
        return wand;
    }

    /** Main thread. Marks a corner; once both are set the zone is saved and the wands disappear. */
    public void markCorner(Player player, ZoneWand.Target target, BlockPosition position, int corner) {
        Messages messages = plugin.messages();
        if (!Perm.ADMIN_SHOP.has(player)) {
            wand.removeAll(player);
            return;
        }
        WandProgress progress = wandProgress.get(player.getUniqueId());
        if (progress == null || !progress.shopId().equals(target.shopId())) {
            progress = new WandProgress(target.shopId(), null, null);
        }
        progress = corner == 1
                ? new WandProgress(target.shopId(), position, progress.corner2())
                : new WandProgress(target.shopId(), progress.corner1(), position);
        wandProgress.put(player.getUniqueId(), progress);
        player.sendMessage(messages.get("shop.pos-set",
                Placeholder.unparsed("corner", String.valueOf(corner)), positionTags(position)));

        BlockPosition first = progress.corner1();
        BlockPosition second = progress.corner2();
        if (first == null || second == null) {
            return;
        }
        if (!first.world().equals(second.world())) {
            wandProgress.put(player.getUniqueId(), new WandProgress(target.shopId(), null, null));
            player.sendMessage(messages.get("shop.pos-missing"));
            return;
        }
        // A shop zone is a plot: the admin marks the area, the height is always the whole world.
        var world = player.getServer().getWorld(first.world());
        int bottom = world == null ? Math.min(first.y(), second.y()) : world.getMinHeight();
        int top = world == null ? Math.max(first.y(), second.y()) : world.getMaxHeight() - 1;
        saveZone(player, target,
                new BlockPosition(first.world(), first.x(), bottom, first.z()),
                new BlockPosition(second.world(), second.x(), top, second.z()));
    }

    private void saveZone(Player player, ZoneWand.Target target, BlockPosition first, BlockPosition second) {
        Messages messages = plugin.messages();
        StorageRepository storage = requireDatabase(player);
        if (storage == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            try {
                var update = storage.setZone(target.shopId(), first, second);
                switch (update.result()) {
                    case SAVED -> {
                        ShopZone zone = update.zone();
                        registry.putZone(zone);
                        runOnMainThread(() -> {
                            wandProgress.remove(playerId);
                            if (player.isOnline()) {
                                wand.removeAll(player);
                            }
                        });
                        player.sendMessage(messages.get("shop.zone-set",
                                Placeholder.unparsed("shop", zone.shopName()),
                                Placeholder.unparsed("dx", String.valueOf(zone.sizeX())),
                                Placeholder.unparsed("dy", String.valueOf(zone.sizeY())),
                                Placeholder.unparsed("dz", String.valueOf(zone.sizeZ()))));
                    }
                    case NOT_FOUND -> {
                        runOnMainThread(() -> {
                            wandProgress.remove(playerId);
                            if (player.isOnline()) {
                                wand.removeAll(player);
                            }
                        });
                        player.sendMessage(messages.get("shop.not-found",
                                Placeholder.unparsed("query", target.shopId().toString())));
                    }
                    case OVERLAPS -> {
                        // Keep the wand: the admin marks the corners again.
                        wandProgress.put(playerId, new WandProgress(target.shopId(), null, null));
                        player.sendMessage(messages.get("shop.zone-overlap"));
                    }
                }
            } catch (SQLException e) {
                fail(player, "Could not set the zone of " + target.shopName(), e);
            }
        });
    }

    public void info(Player player) {
        Messages messages = plugin.messages();
        StorageRepository storage = requireDatabase(player);
        if (storage == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            try {
                var shops = storage.findStorageOf(playerId);
                if (shops.isEmpty()) {
                    player.sendMessage(messages.get("deposit.no-shop"));
                    return;
                }
                player.sendMessage(messages.get("storage.info-header"));
                for (var shop : shops) {
                    player.sendMessage(messages.plain("storage.info-entry",
                            Placeholder.unparsed("shop", shop.shopName()),
                            Placeholder.unparsed("used", String.valueOf(shop.used())),
                            Placeholder.unparsed("capacity", String.valueOf(shop.capacity())),
                            Placeholder.unparsed("blocks", String.valueOf(shop.blocks())),
                            Placeholder.component("zone", shop.hasZone()
                                    ? net.kyori.adventure.text.Component.empty()
                                    : messages.plain("storage.info-no-zone"))));
                }
            } catch (SQLException e) {
                fail(player, "Could not load storage of " + player.getName(), e);
            }
        });
    }

    /** Main thread: Vault calls must not run async. {@code typeId} null = the default type. */
    public void buy(Player player, @Nullable String typeId, int amount) {
        Messages messages = plugin.messages();
        StorageType type = typeId == null ? defaultType() : types.get(typeId);
        if (type == null || !type.buyable()) {
            player.sendMessage(messages.get("storage.type.unknown", Placeholder.unparsed("type", String.valueOf(typeId))));
            return;
        }
        if (!plugin.getConfig().getBoolean("storage.buy.enabled", true)) {
            player.sendMessage(messages.get("storage.buy-disabled"));
            return;
        }
        Economy economy = plugin.economy();
        if (economy == null) {
            player.sendMessage(messages.get("error.economy-missing"));
            return;
        }
        double total = type.price().multiply(BigDecimal.valueOf(amount)).doubleValue();
        TagResolver tags = TagResolver.resolver(
                Placeholder.unparsed("amount", String.valueOf(amount)),
                Placeholder.unparsed("name", type.displayName()),
                Placeholder.unparsed("price", economy.format(total)));
        if (total > 0 && (!economy.has(player, total) || !economy.withdrawPlayer(player, total).transactionSuccess())) {
            player.sendMessage(messages.get("storage.type.not-enough-money", tags));
            return;
        }
        SpecialItemShop.giveInStacks(player, amount, n -> createItem(type, n));
        player.sendMessage(messages.get("storage.type.bought", tags));
    }

    /** Admin give. {@code typeId} null = the default type. */
    public void give(CommandSender sender, Player target, @Nullable String typeId, int amount) {
        Messages messages = plugin.messages();
        StorageType type = typeId == null ? defaultType() : types.get(typeId);
        if (type == null) {
            sender.sendMessage(messages.get("storage.type.unknown", Placeholder.unparsed("type", String.valueOf(typeId))));
            return;
        }
        SpecialItemShop.giveInStacks(target, amount, n -> createItem(type, n));
        TagResolver tags = TagResolver.resolver(Placeholder.unparsed("amount", String.valueOf(amount)),
                Placeholder.unparsed("name", type.displayName()), Placeholder.unparsed("player", target.getName()));
        sender.sendMessage(messages.get("storage.type.given", tags));
        if (sender != target) {
            target.sendMessage(messages.get("storage.type.received", tags));
        }
    }

    /**
     * Creates (or updates) a type from the block in the admin's hand. Blocks that fall or are not
     * solid are refused: they could move away and leave the database pointing at nothing.
     */
    public void createType(Player player, String id, int capacity, BigDecimal price, @Nullable String name) {
        Messages messages = plugin.messages();
        StorageTypeRepository typeRepository = plugin.storageTypes();
        if (typeRepository == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        Material material = player.getInventory().getItemInMainHand().getType();
        if (!StorageType.isValidId(id)) {
            player.sendMessage(messages.get("storage.type.invalid-id", Placeholder.unparsed("type", id)));
            return;
        }
        if (material.isAir() || !material.isBlock() || !material.isItem() || !material.isSolid()
                || material.hasGravity() || material == Material.CRAFTER
                || !material.getKey().getNamespace().equals(org.bukkit.NamespacedKey.MINECRAFT)) {
            player.sendMessage(messages.get("storage.type.invalid-block"));
            return;
        }
        String displayName = name == null || name.isBlank() ? id : name.strip();
        if (displayName.length() > 40) {
            displayName = displayName.substring(0, 40);
        }
        StorageType type = new StorageType(id, displayName, material, capacity, price, true);
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            try {
                typeRepository.upsert(type, playerId);
                setTypes(typeRepository.findAll());
                player.sendMessage(messages.get("storage.type.created", typeTags(type)));
            } catch (SQLException e) {
                fail(player, "Could not save storage type " + id, e);
            }
        });
    }

    public void removeType(CommandSender sender, String id) {
        Messages messages = plugin.messages();
        StorageTypeRepository typeRepository = plugin.storageTypes();
        if (typeRepository == null) {
            sender.sendMessage(messages.get("error.database-required"));
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                var result = typeRepository.remove(id);
                setTypes(typeRepository.findAll());
                sender.sendMessage(messages.get("storage.type." + result.name().toLowerCase().replace('_', '-'),
                        Placeholder.unparsed("type", id)));
            } catch (SQLException e) {
                fail(sender, "Could not remove storage type " + id, e);
            }
        });
    }

    public void listTypes(CommandSender sender) {
        Messages messages = plugin.messages();
        sender.sendMessage(messages.get("storage.type.list-header"));
        for (StorageType type : types.values()) {
            sender.sendMessage(messages.plain(type.buyable() ? "storage.type.list-entry" : "storage.type.list-entry-retired",
                    typeTags(type)));
        }
    }

    public TagResolver typeTags(StorageType type) {
        Economy economy = plugin.economy();
        return TagResolver.resolver(
                Placeholder.unparsed("type", type.id()),
                Placeholder.unparsed("name", type.displayName()),
                Placeholder.unparsed("block", type.material().getKey().getKey()),
                Placeholder.unparsed("capacity", String.valueOf(type.capacity())),
                Placeholder.unparsed("price", economy == null ? type.price().toPlainString()
                        : economy.format(type.price().doubleValue())));
    }

    private void setTypes(List<StorageType> all) {
        Map<String, StorageType> map = new LinkedHashMap<>();
        all.forEach(type -> map.put(type.id(), type));
        if (!map.containsKey(StorageType.DEFAULT_ID)) {
            map.put(StorageType.DEFAULT_ID, StorageType.fallback());
        }
        types = Collections.unmodifiableMap(map);
    }

    private static void giveOrDrop(Player player, ItemStack stack) {
        SpecialItemShop.giveOrDrop(player, stack);
    }

    public void handlePlace(BlockPlaceEvent event) {
        String typeId = item.typeOf(event.getItemInHand()).orElse(null);
        if (typeId == null) {
            return;
        }
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        StorageType type = types.get(typeId);
        if (type == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("storage.type.unknown", Placeholder.unparsed("type", typeId)));
            return;
        }
        StorageRepository storage = plugin.storage();
        if (storage == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        BlockPosition position = BlockPosition.of(event.getBlockPlaced());
        ShopZone zone = registry.zoneAt(position).orElse(null);
        if (zone == null) {
            event.setCancelled(true);
            player.sendMessage(messages.get("storage.outside-zone"));
            return;
        }
        if (!zone.ownerId().equals(player.getUniqueId()) && !Perm.ADMIN_BYPASS.has(player)) {
            event.setCancelled(true);
            player.sendMessage(messages.get("storage.not-yours", Placeholder.unparsed("shop", zone.shopName())));
            return;
        }

        int capacity = type.capacity();
        Material placedMaterial = event.getBlockPlaced().getType();
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            try {
                StorageBlock block = storage.insertBlock(zone, position, capacity, type.id(), playerId);
                registry.putBlock(block);
                player.sendMessage(messages.get("storage.placed",
                        Placeholder.unparsed("shop", zone.shopName()),
                        Placeholder.unparsed("capacity", String.valueOf(capacity))));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not register storage block at " + position, e);
                // Undo the placement: take the block back and return the item.
                runOnMainThread(() -> {
                    Block placed = blockAt(position);
                    if (placed != null && placed.getType() == placedMaterial) {
                        placed.setType(Material.AIR);
                    }
                    if (player.isOnline()) {
                        giveOrDrop(player, createItem(type, 1));
                        player.sendMessage(messages.get("storage.place-failed"));
                    }
                });
            }
        });
    }

    public void handleBreak(BlockBreakEvent event, StorageBlock storageBlock) {
        event.setCancelled(true);
        Messages messages = plugin.messages();
        Player player = event.getPlayer();
        TagResolver shopTag = Placeholder.unparsed("shop", storageBlock.shopName());
        boolean owner = registry.zoneOf(storageBlock.shopId())
                .map(zone -> zone.ownerId().equals(player.getUniqueId()))
                .orElse(false);
        if (!owner && !Perm.ADMIN_BYPASS.has(player)) {
            player.sendMessage(messages.get("storage.break-denied", shopTag));
            return;
        }
        StorageRepository storage = requireDatabase(player);
        if (storage == null || !breaking.add(storageBlock.id())) {
            return;
        }
        plugin.dbExecutor().execute(() -> {
            try {
                boolean deleted = storage.deleteBlock(storageBlock.id());
                registry.removeBlock(storageBlock.id());
                runOnMainThread(() -> {
                    breaking.remove(storageBlock.id());
                    if (!deleted) {
                        return; // Already gone from the database: it is a plain block now.
                    }
                    // A retired type still exists; a deleted one (no blocks should remain) falls back to the default.
                    StorageType type = storageBlock.typeId() == null ? null : types.get(storageBlock.typeId());
                    Block block = blockAt(storageBlock.position());
                    if (block != null && !block.isEmpty()) {
                        if (block.getState() instanceof Container container) {
                            container.getInventory().clear();
                        }
                        block.setType(Material.AIR);
                        block.getWorld().dropItemNaturally(block.getLocation().add(0.5, 0.5, 0.5),
                                createItem(type == null ? defaultType() : type, 1));
                    }
                    player.sendMessage(messages.get("storage.removed", shopTag,
                            Placeholder.unparsed("capacity", String.valueOf(storageBlock.capacity()))));
                });
            } catch (SQLException e) {
                breaking.remove(storageBlock.id());
                fail(player, "Could not remove storage block " + storageBlock.id(), e);
            }
        });
    }

    private Block blockAt(BlockPosition position) {
        var world = plugin.getServer().getWorld(position.world());
        return world == null ? null : world.getBlockAt(position.x(), position.y(), position.z());
    }

    private StorageRepository requireDatabase(CommandSender sender) {
        StorageRepository storage = plugin.storage();
        if (storage == null) {
            sender.sendMessage(plugin.messages().get("error.database-required"));
        }
        return storage;
    }

    private void fail(CommandSender sender, String logMessage, SQLException e) {
        plugin.getLogger().log(Level.WARNING, logMessage, e);
        sender.sendMessage(plugin.messages().get("storage.failed"));
    }

    private void runOnMainThread(Runnable task) {
        if (plugin.isEnabled()) {
            plugin.getServer().getScheduler().runTask(plugin, task);
        }
    }

    private static TagResolver positionTags(BlockPosition position) {
        return TagResolver.resolver(
                Placeholder.unparsed("world", position.world()),
                Placeholder.unparsed("x", String.valueOf(position.x())),
                Placeholder.unparsed("y", String.valueOf(position.y())),
                Placeholder.unparsed("z", String.valueOf(position.z())));
    }
}
