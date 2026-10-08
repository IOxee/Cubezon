package es.fractalgamestudios.cubezon;

import es.fractalgamestudios.cubezon.command.CubezonCommand;
import es.fractalgamestudios.cubezon.config.YamlDefaults;
import es.fractalgamestudios.cubezon.database.CustomItemRepository;
import es.fractalgamestudios.cubezon.database.Database;
import es.fractalgamestudios.cubezon.database.EscrowRepository;
import es.fractalgamestudios.cubezon.database.ListingRepository;
import es.fractalgamestudios.cubezon.database.MailboxRepository;
import es.fractalgamestudios.cubezon.database.OrderRepository;
import es.fractalgamestudios.cubezon.database.PickupRepository;
import es.fractalgamestudios.cubezon.database.RoleRepository;
import es.fractalgamestudios.cubezon.database.RoleplayRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository;
import es.fractalgamestudios.cubezon.database.ShopSlotsRepository;
import es.fractalgamestudios.cubezon.database.LockerRepository;
import es.fractalgamestudios.cubezon.database.PlayerRepository;
import es.fractalgamestudios.cubezon.database.PostgresLinkCodeStore;
import es.fractalgamestudios.cubezon.database.StorageRepository;
import es.fractalgamestudios.cubezon.database.StorageTypeRepository;
import es.fractalgamestudios.cubezon.deposit.DepositController;
import es.fractalgamestudios.cubezon.deposit.DepositMenuListener;
import es.fractalgamestudios.cubezon.gui.ChatPrompt;
import es.fractalgamestudios.cubezon.gui.GuiListener;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.item.ItemController;
import es.fractalgamestudios.cubezon.item.ItemIdentity;
import es.fractalgamestudios.cubezon.link.InMemoryLinkCodeStore;
import es.fractalgamestudios.cubezon.link.LinkCodeGenerator;
import es.fractalgamestudios.cubezon.link.LinkCodeStore;
import es.fractalgamestudios.cubezon.link.LinkService;
import es.fractalgamestudios.cubezon.listener.PlayerJoinListener;
import es.fractalgamestudios.cubezon.locker.LockerController;
import es.fractalgamestudios.cubezon.locker.LockerListener;
import es.fractalgamestudios.cubezon.locker.LockerRegistry;
import es.fractalgamestudios.cubezon.mailbox.MailboxController;
import es.fractalgamestudios.cubezon.mailbox.MailboxListener;
import es.fractalgamestudios.cubezon.order.OrderMode;
import es.fractalgamestudios.cubezon.order.OrderProcessor;
import es.fractalgamestudios.cubezon.pickup.PickupController;
import es.fractalgamestudios.cubezon.pickup.PickupMenuListener;
import es.fractalgamestudios.cubezon.roleplay.RoleplayController;
import es.fractalgamestudios.cubezon.roleplay.RoleplayListener;
import es.fractalgamestudios.cubezon.shop.ShopSlotsController;
import es.fractalgamestudios.cubezon.storage.StorageController;
import es.fractalgamestudios.cubezon.storage.StorageListener;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.Nullable;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class CubezonPlugin extends JavaPlugin {

    /** How long onDisable waits for pending database work (e.g. a deposit) to finish. */
    private static final long SHUTDOWN_WAIT_SECONDS = 10;

    private final ExecutorService dbExecutor = newDbExecutor();
    private Messages messages;
    private LinkService linkService;
    private DepositController depositController;
    private LockerController lockerController;
    private StorageController storageController;
    private OrderProcessor orderProcessor;
    private PickupController pickupController;
    private RoleplayController roleplayController;
    private ItemController itemController;
    private ShopSlotsController shopSlotsController;
    private ChatPrompt chatPrompt;
    private Sounds sounds;
    private MenuLayout menuLayout;
    private MailboxController mailboxController;
    private ItemIdentity itemIdentity;
    /** Read once at startup: switching modes needs a restart (orders in flight would mix both flows). */
    private OrderMode orderMode = OrderMode.AUTOMATIC;
    private @Nullable Database database;
    private @Nullable PlayerRepository players;
    private @Nullable ListingRepository listings;
    private @Nullable EscrowRepository escrow;
    private @Nullable LockerRepository lockers;
    private @Nullable StorageRepository storage;
    private @Nullable StorageTypeRepository storageTypes;
    private @Nullable OrderRepository orders;
    private @Nullable PickupRepository pickups;
    private @Nullable RoleplayRepository roleplay;
    private @Nullable CustomItemRepository customItems;
    private @Nullable ShopPanelRepository shopPanel;
    private @Nullable ShopSlotsRepository shopSlots;
    private @Nullable RoleRepository roles;
    private @Nullable MailboxRepository mailboxes;
    private @Nullable Economy economy;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        updateConfigFile();
        orderMode = OrderMode.parse(getConfig().getString("orders.mode", "automatic"));
        getLogger().info("Order mode: " + orderMode.key() + " (changing it requires a restart).");
        messages = new Messages(this);
        sounds = new Sounds(this);
        menuLayout = new MenuLayout(this);
        loadItemIdentity();
        loadSettings();
        economy = hookEconomy();

        depositController = new DepositController(this);
        lockerController = new LockerController(this, new LockerRegistry());
        storageController = new StorageController(this);
        pickupController = new PickupController(this);
        roleplayController = new RoleplayController(this);
        itemController = new ItemController(this);
        shopSlotsController = new ShopSlotsController(this);
        shopSlotsController.publishDefault();
        mailboxController = new MailboxController(this);
        mailboxController.itemShop().registerRecipe();
        mailboxController.publishSettings();
        roleplayController.itemShop().registerRecipe();
        roleplayController.publishMode();
        storageController.registerRecipe();
        var pluginManager = getServer().getPluginManager();
        pluginManager.registerEvents(new PlayerJoinListener(this), this);
        pluginManager.registerEvents(new GuiListener(this, sounds), this);
        chatPrompt = new ChatPrompt(this, this::messages, sounds);
        pluginManager.registerEvents(chatPrompt, this);
        pluginManager.registerEvents(new DepositMenuListener(this, depositController), this);
        pluginManager.registerEvents(new LockerListener(lockerController, this::messages), this);
        pluginManager.registerEvents(new StorageListener(storageController, this::messages), this);
        pluginManager.registerEvents(new PickupMenuListener(this, pickupController), this);
        pluginManager.registerEvents(new MailboxListener(mailboxController), this);
        pluginManager.registerEvents(new RoleplayListener(this, roleplayController, lockerController.registry()), this);
        // Intervals in config.yml settings (read at startup).
        long jobsTicks = 20L * Math.clamp(getConfig().getLong("settings.order-jobs-seconds", 60), 10, 3600);
        long refreshTicks = 20L * Math.clamp(getConfig().getLong("settings.refresh-seconds", 60), 10, 3600);
        getServer().getScheduler().runTaskTimer(this, roleplayController::runJobs, jobsTicks, jobsTicks);
        getServer().getScheduler().runTaskTimer(this, this::refreshRegistries, 0L, refreshTicks);
        orderProcessor = new OrderProcessor(this);
        orderProcessor.start(20L * Math.max(1, getConfig().getLong("orders.poll-seconds", 5)));
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS,
                event -> new CubezonCommand(this).register(event.registrar()));
    }

    @Override
    public void onDisable() {
        if (storageController != null) {
            storageController.unregisterRecipe();
        }
        if (roleplayController != null) {
            roleplayController.itemShop().unregisterRecipe();
        }
        if (mailboxController != null) {
            mailboxController.itemShop().unregisterRecipe();
        }
        dbExecutor.shutdown();
        try {
            if (!dbExecutor.awaitTermination(SHUTDOWN_WAIT_SECONDS, TimeUnit.SECONDS)) {
                getLogger().severe("Database tasks still running after " + SHUTDOWN_WAIT_SECONDS + "s; they will be interrupted.");
                dbExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        closeDatabase();
    }

    /**
     * Adds to the server's config.yml the options of this version it lacks (with their comments),
     * keeping every value already there. Otherwise options added after the file was created, such
     * as orders.mode, would work with their default but never show up to be changed.
     */
    private void updateConfigFile() {
        InputStream bundled = getResource("config.yml");
        if (bundled == null) {
            return;
        }
        YamlConfiguration defaults = YamlConfiguration.loadConfiguration(new InputStreamReader(bundled, StandardCharsets.UTF_8));
        List<String> added = YamlDefaults.addMissing(getConfig(), defaults);
        if (!added.isEmpty()) {
            saveConfig();
            getLogger().info("Added new options to config.yml: " + String.join(", ", added));
        }
    }

    /**
     * Reloads config.yml, messages and dependent services. The order mode is not reloaded.
     *
     * @return true if config.yml asks for another order mode (it applies after a restart)
     */
    public boolean reload() {
        reloadConfig();
        updateConfigFile();
        menuLayout.reload();
        messages.reload();
        loadItemIdentity();
        closeDatabase();
        loadSettings();
        storageController.registerRecipe();
        roleplayController.itemShop().registerRecipe();
        mailboxController.itemShop().registerRecipe();
        shopSlotsController.publishDefault();
        mailboxController.publishSettings();
        refreshRegistries();
        return OrderMode.parse(getConfig().getString("orders.mode", "automatic")) != orderMode;
    }

    /** Item plugins are softdepends, so they are enabled before this runs. */
    private void loadItemIdentity() {
        itemIdentity = ItemIdentity.create(getServer().getPluginManager(), getConfig().getStringList("items.pdc-keys"), getLogger());
        getLogger().info("Custom item sources: " + (itemIdentity.active().isEmpty() ? "none" : String.join(", ", itemIdentity.active())));
    }

    private void refreshRegistries() {
        lockerController.refresh();
        storageController.refresh();
        roleplayController.refresh();
        mailboxController.refresh();
    }

    private void loadSettings() {
        database = Database.fromConfig(getConfig(), getLogger());
        players = database == null ? null : new PlayerRepository(database);
        listings = database == null ? null : new ListingRepository(database);
        escrow = database == null ? null : new EscrowRepository(database);
        lockers = database == null ? null : new LockerRepository(database);
        storage = database == null ? null : new StorageRepository(database);
        storageTypes = database == null ? null : new StorageTypeRepository(database);
        orders = database == null ? null : new OrderRepository(database);
        pickups = database == null ? null : new PickupRepository(database);
        roleplay = database == null ? null : new RoleplayRepository(database);
        customItems = database == null ? null : new CustomItemRepository(database);
        shopPanel = database == null ? null : new ShopPanelRepository(database);
        shopSlots = database == null ? null : new ShopSlotsRepository(database);
        roles = database == null ? null : new RoleRepository(database);
        mailboxes = database == null ? null : new MailboxRepository(database);

        LinkCodeStore linkStore;
        if (database != null) {
            linkStore = new PostgresLinkCodeStore(database);
        } else {
            getLogger().warning("Link codes are kept in memory only; the web cannot redeem them.");
            linkStore = new InMemoryLinkCodeStore();
        }
        long ttlMinutes = getConfig().getLong("link.code-ttl-minutes", 10);
        linkService = new LinkService(new LinkCodeGenerator(), linkStore, Duration.ofMinutes(ttlMinutes));
    }

    private void closeDatabase() {
        if (database != null) {
            database.close();
            database = null;
            players = null;
            listings = null;
            escrow = null;
            lockers = null;
            storage = null;
            storageTypes = null;
            orders = null;
            pickups = null;
            roleplay = null;
            customItems = null;
            shopPanel = null;
            shopSlots = null;
            roles = null;
            mailboxes = null;
        }
    }

    private @Nullable Economy hookEconomy() {
        RegisteredServiceProvider<Economy> provider = getServer().getServicesManager().getRegistration(Economy.class);
        if (provider == null) {
            getLogger().warning("No economy provider found through Vault; purchases will be unavailable.");
            return null;
        }
        getLogger().info("Hooked into economy: " + provider.getProvider().getName());
        return provider.getProvider();
    }

    private static ExecutorService newDbExecutor() {
        AtomicInteger counter = new AtomicInteger();
        return Executors.newFixedThreadPool(2, task -> {
            Thread thread = new Thread(task, "Cubezon-DB-" + counter.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    /** Runs blocking database work off the main thread. Awaited on shutdown. */
    public ExecutorService dbExecutor() {
        return dbExecutor;
    }

    public Messages messages() {
        return messages;
    }

    public DepositController depositController() {
        return depositController;
    }

    public LockerController lockerController() {
        return lockerController;
    }

    public StorageController storageController() {
        return storageController;
    }

    public LinkService linkService() {
        return linkService;
    }

    public @Nullable Database database() {
        return database;
    }

    public @Nullable PlayerRepository players() {
        return players;
    }

    public @Nullable ListingRepository listings() {
        return listings;
    }

    public @Nullable EscrowRepository escrow() {
        return escrow;
    }

    public @Nullable LockerRepository lockers() {
        return lockers;
    }

    public @Nullable StorageTypeRepository storageTypes() {
        return storageTypes;
    }

    public @Nullable StorageRepository storage() {
        return storage;
    }

    public @Nullable OrderRepository orders() {
        return orders;
    }

    public PickupController pickupController() {
        return pickupController;
    }

    public @Nullable PickupRepository pickups() {
        return pickups;
    }

    public ItemIdentity itemIdentity() {
        return itemIdentity;
    }

    public ItemController itemController() {
        return itemController;
    }

    public Sounds sounds() {
        return sounds;
    }

    public MenuLayout menuLayout() {
        return menuLayout;
    }

    public ChatPrompt chatPrompt() {
        return chatPrompt;
    }

    public ShopSlotsController shopSlotsController() {
        return shopSlotsController;
    }

    public MailboxController mailboxController() {
        return mailboxController;
    }

    public @Nullable MailboxRepository mailboxes() {
        return mailboxes;
    }

    public @Nullable RoleRepository roles() {
        return roles;
    }

    public @Nullable ShopSlotsRepository shopSlots() {
        return shopSlots;
    }

    public @Nullable ShopPanelRepository shopPanel() {
        return shopPanel;
    }

    public @Nullable CustomItemRepository customItems() {
        return customItems;
    }

    public OrderMode orderMode() {
        return orderMode;
    }

    public RoleplayController roleplayController() {
        return roleplayController;
    }

    public @Nullable RoleplayRepository roleplay() {
        return roleplay;
    }

    public @Nullable Economy economy() {
        return economy;
    }
}
