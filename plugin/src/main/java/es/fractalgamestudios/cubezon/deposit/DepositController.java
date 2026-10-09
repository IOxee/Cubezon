package es.fractalgamestudios.cubezon.deposit;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.EscrowRepository;
import es.fractalgamestudios.cubezon.database.ListingRepository;
import es.fractalgamestudios.cubezon.gui.Sounds;
import es.fractalgamestudios.cubezon.i18n.Messages;
import com.google.common.collect.ImmutableMultimap;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.logging.Level;

/**
 * /cz deposit flow: pick a listing, drop its units in a chest, store them in escrow on close.
 * Items leave the chest on the main thread; if storing them fails they go back to the player.
 * When even that is impossible (player offline, server stopping) they are logged in Base64 so
 * an admin can restore them: losing a deposit is recoverable, duplicating items is not.
 */
public final class DepositController {

    private final CubezonPlugin plugin;

    public DepositController(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    public void openListings(Player player) {
        Messages messages = plugin.messages();
        ListingRepository listings = plugin.listings();
        if (listings == null) {
            player.sendMessage(messages.get("error.database-required"));
            return;
        }
        UUID playerId = player.getUniqueId();
        plugin.dbExecutor().execute(() -> {
            List<DepositableListing> found;
            List<String> shopStatuses;
            try {
                found = listings.findDepositable(playerId, ListingMenu.SIZE);
                shopStatuses = found.isEmpty() ? listings.findShopStatuses(playerId) : List.of();
            } catch (SQLException e) {
                plugin.getLogger().log(Level.WARNING, "Could not load listings of " + player.getName(), e);
                player.sendMessage(messages.get("deposit.load-failed"));
                return;
            }
            if (found.isEmpty()) {
                // Tell the seller what is missing: a shop, its approval, or listings.
                if (shopStatuses.isEmpty()) {
                    player.sendMessage(messages.get("deposit.no-shop"));
                } else if (!shopStatuses.contains("APPROVED")) {
                    player.sendMessage(messages.get("deposit.shop-not-approved"));
                } else {
                    player.sendMessage(messages.get("deposit.no-listings"));
                }
                return;
            }
            runOnMainThread(() -> {
                if (player.isOnline()) {
                    player.openInventory(buildListingMenu(found));
                }
            });
        });
    }

    public void openDeposit(Player player, DepositableListing listing) {
        DepositMenu menu = new DepositMenu(listing);
        Inventory inventory = plugin.getServer().createInventory(menu, DepositMenu.SIZE,
                plugin.messages().plain("deposit.target-title",
                        Placeholder.unparsed("title", shortTitle(listing.title())),
                        Placeholder.unparsed("amount", String.valueOf(listing.unitAmount()))));
        menu.attach(inventory);
        player.openInventory(inventory);
    }

    /** A chest title only fits about 30 characters: cut the product name (config.yml settings.menu-title-name-length). */
    private String shortTitle(String title) {
        int max = Math.clamp(plugin.getConfig().getInt("settings.menu-title-name-length", 22), 8, 40);
        return title.length() <= max ? title : title.substring(0, max - 1).stripTrailing() + "…";
    }

    /** Called on the main thread when a DepositMenu closes (also on quit or shutdown kicks). */
    public void handleClose(Player player, DepositMenu menu) {
        if (!menu.markProcessed()) {
            return;
        }
        DepositableListing listing = menu.listing();
        Messages messages = plugin.messages();
        ItemStack sample = exactSample(listing);

        // Identical items (same material, enchantments, name...) are piled up and split into
        // units of unit_amount; anything else, or the leftover of a pile, goes back.
        List<ItemStack> piles = new ArrayList<>();
        List<Integer> pileAmounts = new ArrayList<>();
        List<ItemStack> rejected = new ArrayList<>();
        boolean unitTooBig = false;
        for (ItemStack item : menu.getInventory().getContents()) {
            if (item == null || item.isEmpty()) {
                continue;
            }
            if (!DepositRules.matchesKey(listing.itemKey(), plugin.itemIdentity().identify(item).key())
                    || (sample != null && !sample.isSimilar(item))) {
                rejected.add(item.clone());
                continue;
            }
            if (!DepositRules.unitFitsInOneStack(listing.unitAmount(), item.getMaxStackSize())) {
                unitTooBig = true;
                rejected.add(item.clone());
                continue;
            }
            int pile = indexOfSimilar(piles, item);
            if (pile < 0) {
                piles.add(item.asOne());
                pileAmounts.add(item.getAmount());
            } else {
                pileAmounts.set(pile, pileAmounts.get(pile) + item.getAmount());
            }
        }
        menu.getInventory().clear();

        List<ItemStack> units = new ArrayList<>();
        for (int i = 0; i < piles.size(); i++) {
            ItemStack prototype = piles.get(i);
            DepositRules.Split split = DepositRules.split(pileAmounts.get(i), listing.unitAmount());
            for (int unit = 0; unit < split.units(); unit++) {
                units.add(prototype.asQuantity(listing.unitAmount()));
            }
            rejected.addAll(stacksOf(prototype, split.remainder()));
        }

        if (unitTooBig) {
            player.sendMessage(messages.get("deposit.unit-too-big",
                    Placeholder.unparsed("amount", String.valueOf(listing.unitAmount())),
                    Placeholder.unparsed("material", listing.itemKey())));
        }
        if (!rejected.isEmpty()) {
            giveBack(player, rejected);
            int returnedItems = rejected.stream().mapToInt(ItemStack::getAmount).sum();
            player.sendMessage(messages.get("deposit.returned",
                    Placeholder.unparsed("count", String.valueOf(returnedItems)),
                    Placeholder.unparsed("amount", String.valueOf(listing.unitAmount())),
                    Placeholder.unparsed("material", listing.itemKey())));
        }
        if (units.isEmpty()) {
            return;
        }

        EscrowRepository escrow = plugin.escrow();
        if (escrow == null) {
            giveBack(player, units);
            player.sendMessage(messages.get("error.database-required"));
            return;
        }

        List<byte[]> data = units.stream().map(ItemStack::serializeAsBytes).toList();
        UUID playerId = player.getUniqueId();
        String playerName = player.getName();
        plugin.dbExecutor().execute(() -> {
            EscrowRepository.DepositResult result;
            try {
                result = escrow.deposit(listing.id(), playerId, listing.itemKey(), listing.unitAmount(),
                        listing.exact() ? listing.sample() : null, data);
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not store the deposit of " + playerName, e);
                returnLater(playerId, playerName, units, messages.get("deposit.failed"));
                return;
            }
            if (!result.listingValid()) {
                returnLater(playerId, playerName, units, messages.get("deposit.rejected"));
                return;
            }
            TagResolver storage = TagResolver.resolver(
                    Placeholder.unparsed("used", String.valueOf(result.usedBefore() + result.stored())),
                    Placeholder.unparsed("capacity", String.valueOf(result.capacity())));
            if (result.stored() == 0) {
                returnLater(playerId, playerName, units, messages.get("deposit.full", storage));
                return;
            }
            plugin.sounds().play(player, Sounds.Event.SUCCESS);
            player.sendMessage(messages.get("deposit.done",
                    Placeholder.unparsed("units", String.valueOf(result.stored())),
                    Placeholder.unparsed("title", listing.title()),
                    storage));
            if (result.stored() < units.size()) {
                List<ItemStack> leftover = units.subList(result.stored(), units.size());
                returnLater(playerId, playerName, List.copyOf(leftover), messages.get("deposit.no-space",
                        Placeholder.unparsed("returned", String.valueOf(leftover.size())),
                        storage));
            }
        });
    }

    private Inventory buildListingMenu(List<DepositableListing> listings) {
        Messages messages = plugin.messages();
        ListingMenu menu = new ListingMenu(listings);
        Inventory inventory = plugin.getServer().createInventory(menu, ListingMenu.SIZE,
                messages.plain("deposit.menu-title"));
        menu.attach(inventory);
        for (int slot = 0; slot < listings.size(); slot++) {
            inventory.setItem(slot, icon(listings.get(slot), messages));
        }
        return inventory;
    }

    private static ItemStack icon(DepositableListing listing, Messages messages) {
        Material material = Material.matchMaterial(listing.material());
        ItemStack icon = new ItemStack(material != null && material.isItem() ? material : Material.BARRIER);
        icon.editMeta(meta -> {
            meta.displayName(Component.text(listing.title()).decoration(TextDecoration.ITALIC, false));
            // Icons only: no "When in Main Hand" damage/speed tooltip.
            meta.setAttributeModifiers(ImmutableMultimap.of());
            meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            meta.lore(List.of(
                    lore(messages, "deposit.lore-shop", Placeholder.unparsed("shop", listing.shopName())),
                    lore(messages, "deposit.lore-unit",
                            Placeholder.unparsed("amount", String.valueOf(listing.unitAmount())),
                            Placeholder.unparsed("material", listing.itemKey())),
                    lore(messages, "deposit.lore-price", Placeholder.unparsed("price", listing.unitPrice().toPlainString())),
                    lore(messages, "deposit.lore-stock", Placeholder.unparsed("stock", String.valueOf(listing.unitsAvailable()))),
                    lore(messages, "deposit.lore-click")));
        });
        return icon;
    }

    private static Component lore(Messages messages, String key, TagResolver... resolvers) {
        return messages.plain(key, resolvers).decoration(TextDecoration.ITALIC, false);
    }

    /**
     * The sample an EXACT listing requires (same NBT, any amount), or null for KEY listings. An
     * unreadable sample matches nothing, so nothing is deposited until the owner sets it again.
     */
    private ItemStack exactSample(DepositableListing listing) {
        if (!listing.exact()) {
            return null;
        }
        try {
            return ItemStack.deserializeBytes(listing.sample());
        } catch (RuntimeException e) {
            plugin.getLogger().warning("Listing " + listing.id() + " has an unreadable sample: " + e.getMessage());
            return new ItemStack(org.bukkit.Material.STRUCTURE_VOID);
        }
    }

    private static int indexOfSimilar(List<ItemStack> piles, ItemStack item) {
        for (int i = 0; i < piles.size(); i++) {
            if (piles.get(i).isSimilar(item)) {
                return i;
            }
        }
        return -1;
    }

    /** {@code amount} items like the prototype, in stacks no bigger than its max stack size. */
    private static List<ItemStack> stacksOf(ItemStack prototype, int amount) {
        List<ItemStack> stacks = new ArrayList<>();
        int maxStack = prototype.getMaxStackSize();
        for (int left = amount; left > 0; left -= maxStack) {
            stacks.add(prototype.asQuantity(Math.min(left, maxStack)));
        }
        return stacks;
    }

    /** Main thread only. Whatever does not fit in the inventory drops at the player's feet. */
    private static void giveBack(Player player, List<ItemStack> items) {
        player.getInventory().addItem(items.toArray(ItemStack[]::new)).values()
                .forEach(leftover -> player.getWorld().dropItemNaturally(player.getLocation(), leftover));
    }

    private void returnLater(UUID playerId, String playerName, List<ItemStack> items, Component message) {
        if (!plugin.isEnabled()) {
            logLost(playerName, items);
            return;
        }
        runOnMainThread(() -> {
            Player player = plugin.getServer().getPlayer(playerId);
            if (player == null) {
                logLost(playerName, items);
                return;
            }
            giveBack(player, items);
            player.sendMessage(message);
        });
    }

    private void logLost(String playerName, List<ItemStack> items) {
        Base64.Encoder base64 = Base64.getEncoder();
        StringBuilder data = new StringBuilder();
        for (ItemStack item : items) {
            data.append(System.lineSeparator()).append(base64.encodeToString(item.serializeAsBytes()));
        }
        plugin.getLogger().severe("Could not return " + items.size() + " deposited stacks to " + playerName
                + ". Restore them from this data (ItemStack#serializeAsBytes, Base64):" + data);
    }

    private void runOnMainThread(Runnable task) {
        plugin.getServer().getScheduler().runTask(plugin, task);
    }
}
