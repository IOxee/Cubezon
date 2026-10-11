package es.fractalgamestudios.cubezon.roleplay;

import es.fractalgamestudios.cubezon.command.Perm;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository;
import es.fractalgamestudios.cubezon.database.ShopPanelRepository.PanelListing;
import es.fractalgamestudios.cubezon.deposit.DepositableListing;
import es.fractalgamestudios.cubezon.gui.Gui;
import es.fractalgamestudios.cubezon.gui.ChatPrompt;
import es.fractalgamestudios.cubezon.gui.Icons;
import es.fractalgamestudios.cubezon.gui.MenuLayout;
import es.fractalgamestudios.cubezon.i18n.Messages;
import es.fractalgamestudios.cubezon.item.ItemKey;
import es.fractalgamestudios.cubezon.roles.ShopPermission;
import es.fractalgamestudios.cubezon.storage.SpecialItemShop;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.inventory.ItemStack;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.logging.Level;

/** The company computer's product screens: listings, stock in and out, samples and product edits. */
final class ProductScreens {

    private final CubezonPlugin plugin;
    private final PanelKit kit;
    /** Slots and icons of the buttons (menus.yml). */
    private final MenuLayout menu;

    ProductScreens(CubezonPlugin plugin, PanelKit kit, MenuLayout menu) {
        this.plugin = plugin;
        this.kit = kit;
        this.menu = menu;
    }

    void showListings(Player player, PanelContext context) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        kit.async(player, () -> panel.listings(context.shop().id(), PanelKit.LIST_SLOTS), listings -> {
            Messages messages = plugin.messages();
            Gui gui = new Gui(plugin.getServer(), 6, messages.plain("panel.titles.listings", kit.shopTags(context.shop())));
            for (int slot = 0; slot < listings.size(); slot++) {
                PanelListing listing = listings.get(slot);
                gui.set(slot, listingIcon(listing, messages, List.of("panel.listing.key", "panel.listing.unit",
                                "panel.listing.stock", "panel.listing.mode", "panel.listing.open")),
                        (p, click) -> showListing(p, context, listing));
            }
            if (listings.isEmpty()) {
                gui.set(menu.slot("listings.listings-empty", 22), Icons.decorate(menu.icon("listings.listings-empty", Material.PAPER), messages, "panel.listings.empty", List.of()));
            }
            if (context.can(ShopPermission.PRODUCTS_MANAGE)) {
                gui.set(menu.slot("listings.listings-new", 53), Icons.decorate(menu.icon("listings.listings-new", Material.WRITABLE_BOOK), messages, "panel.listings.new", List.of("panel.listings.new-hint")),
                        (p, click) -> createProduct(p, context));
            }
            kit.back(gui, context);
            gui.fill(menu.filler()).open(player);
        });
    }

    private void showListing(Player player, PanelContext context, PanelListing listing) {
        Messages messages = plugin.messages();
        TagResolver tags = listingTags(listing);
        Gui gui = new Gui(plugin.getServer(), 3, messages.plain("panel.listing.title", tags));

        gui.set(menu.slot("listing.product", 4), listingIcon(listing, messages, List.of("panel.listing.key", "panel.listing.unit", "panel.listing.stock")));
        if (context.can(ShopPermission.STOCK_DEPOSIT)) {
            gui.set(menu.slot("listing.listing-deposit", 10), Icons.decorate(menu.icon("listing.listing-deposit", Material.HOPPER), messages, "panel.listing.deposit", List.of("panel.listing.deposit-hint"), tags),
                    (p, click) -> plugin.depositController().openDeposit(p, depositable(context, listing)));
        }
        if (context.can(ShopPermission.STOCK_WITHDRAW)) {
            gui.set(menu.slot("listing.listing-withdraw", 11), Icons.decorate(menu.icon("listing.listing-withdraw", Material.DROPPER), messages, "panel.listing.withdraw", List.of("panel.listing.withdraw-hint"), tags),
                    (p, click) -> {
                        if (!PanelKit.isRight(click)) {
                            withdraw(p, context, listing, 1);
                        } else if (listing.available() < 1) {
                            p.sendMessage(messages.get("panel.listing.nothing-to-withdraw"));
                        } else {
                            plugin.chatPrompt().askAmount(p, "prompt.withdraw", listing.available(),
                                    amount -> withdraw(p, context, listing, amount));
                        }
                    });
        }
        if (context.can(ShopPermission.PRODUCTS_MANAGE)) {
            gui.set(menu.slot("listing.sample-mode", 12), Icons.decorate(listing.exact()
                            ? menu.icon("listing.sample-exact", Material.ENCHANTED_BOOK)
                            : menu.icon("listing.sample-type", Material.BOOK), messages, "panel.listing.sample",
                            List.of("panel.listing.mode", "panel.listing.sample-hint"), tags),
                    (p, click) -> setSample(p, context, listing, !PanelKit.isRight(click)));
            gui.set(menu.slot("listing.listing-rename", 14), Icons.decorate(menu.icon("listing.listing-rename", Material.NAME_TAG), messages, "panel.listing.rename", List.of("panel.listing.rename-hint"), tags),
                    (p, click) -> plugin.chatPrompt().askText(p, "prompt.product-title", titleMin(), titleMax(),
                            title -> editProduct(p, context, listing, "panel.listing.renamed", panel -> panel.setTitle(
                                    listing.id(), context.shop().id(), p.getUniqueId(), Perm.ADMIN_BYPASS.has(p), title))));
            gui.set(menu.slot("listing.listing-price-button", 15), Icons.decorate(menu.icon("listing.listing-price-button", Material.GOLD_NUGGET), messages, "panel.listing.price-button", List.of("panel.listing.price-hint"), tags),
                    (p, click) -> plugin.chatPrompt().askPrice(p, "prompt.product-price",
                            price -> editProduct(p, context, listing, "panel.listing.price-changed", panel -> panel.setPrice(
                                    listing.id(), context.shop().id(), p.getUniqueId(), Perm.ADMIN_BYPASS.has(p), price))));
            boolean active = "ACTIVE".equals(listing.status());
            gui.set(menu.slot("listing.status", 16), Icons.decorate(active ? menu.icon("listing.status-active", Material.LIME_DYE)
                            : menu.icon("listing.status-paused", Material.GRAY_DYE), messages,
                            active ? "panel.listing.pause" : "panel.listing.activate", List.of("panel.listing.status-line"), tags),
                    (p, click) -> editProduct(p, context, listing, active ? "panel.listing.paused" : "panel.listing.activated",
                            panel -> panel.setActive(listing.id(), context.shop().id(), p.getUniqueId(),
                                    Perm.ADMIN_BYPASS.has(p), !active)));
            gui.set(menu.slot("listing.listing-remove", 26), Icons.decorate(menu.icon("listing.listing-remove", Material.BARRIER), messages, "panel.listing.remove", List.of("panel.listing.remove-hint"), tags),
                    (p, click) -> {
                        if (click != ClickType.SHIFT_LEFT && click != ClickType.SHIFT_RIGHT) {
                            p.sendMessage(messages.get("panel.listing.remove-confirm"));
                            return;
                        }
                        editProduct(p, context, listing, "panel.listing.removed", panel -> panel.removeListing(
                                listing.id(), context.shop().id(), p.getUniqueId(), Perm.ADMIN_BYPASS.has(p)));
                    });
        }
        if (listing.exact() && listing.sample() != null) {
            gui.set(menu.slot("listing.sample-preview", 8), sampleIcon(listing, messages));
        }
        gui.set(menu.slot("listing.back", 22), Icons.decorate(menu.icon("listing.back", Material.ARROW), messages, "panel.back", List.of()), (p, click) -> showListings(p, context));
        gui.fill(menu.filler()).open(player);
    }

    /**
     * New product from the item in hand: its key and base come from the item; name, items per unit
     * and price are asked in chat, one after the other.
     */
    private void createProduct(Player player, PanelContext context) {
        Messages messages = plugin.messages();
        ItemStack hand = player.getInventory().getItemInMainHand();
        if (hand.isEmpty()) {
            player.sendMessage(messages.get("panel.listings.new-empty-hand"));
            return;
        }
        ItemKey key = plugin.itemIdentity().identify(hand);
        int maxUnit = Math.min(99, hand.getMaxStackSize());
        ChatPrompt prompt = plugin.chatPrompt();
        prompt.askText(player, "prompt.product-title", titleMin(), titleMax(), title ->
                prompt.askAmount(player, "prompt.product-unit", maxUnit, unit ->
                        prompt.askPrice(player, "prompt.product-price", price -> saveProduct(player, context, key, title, unit, price))));
    }

    private void saveProduct(Player player, PanelContext context, ItemKey key, String title, int unit, BigDecimal price) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> panel.createListing(context.shop().id(), playerId, admin, title, key.baseMaterial(), key.key(),
                unit, price), created -> {
            Messages messages = plugin.messages();
            if (created.isEmpty()) {
                player.sendMessage(messages.get("panel.listings.new-denied"));
                return;
            }
            player.sendMessage(messages.get("panel.listings.created", Placeholder.unparsed("title", title),
                    Placeholder.unparsed("key", key.key()), Placeholder.unparsed("amount", String.valueOf(unit))));
            plugin.getLogger().info("Product " + created.get() + " (" + key.key() + ") created in " + context.shop().slug()
                    + " by " + player.getName());
        });
    }

    private interface ProductChange {
        boolean apply(ShopPanelRepository panel) throws SQLException;
    }

    /** Owner-only product edits: the SQL checks the owner again; false = not allowed or not possible now. */
    private void editProduct(Player player, PanelContext context, PanelListing listing, String doneKey, ProductChange change) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        kit.async(player, () -> change.apply(panel), changed -> {
            Messages messages = plugin.messages();
            player.sendMessage(messages.get(changed ? doneKey : "panel.listing.change-failed",
                    Placeholder.unparsed("title", listing.title())));
            showListings(player, context);
        });
    }

    /** Owner only. Units are marked RETURNED in the database before they are handed over. */
    private void withdraw(Player player, PanelContext context, PanelListing listing, int count) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> panel.withdraw(listing.id(), context.shop().id(), playerId, admin, count), units -> {
            Messages messages = plugin.messages();
            if (units.isEmpty()) {
                player.sendMessage(messages.get("panel.listing.nothing-to-withdraw"));
            } else {
                for (byte[] unit : units) {
                    try {
                        SpecialItemShop.giveOrDrop(player, ItemStack.deserializeBytes(unit));
                    } catch (RuntimeException e) {
                        plugin.getLogger().log(Level.SEVERE, "Withdrawn unit of listing " + listing.id()
                                + " is unreadable; data (Base64): " + Base64.getEncoder().encodeToString(unit), e);
                    }
                }
                player.sendMessage(messages.get("panel.listing.withdrawn",
                        Placeholder.unparsed("units", String.valueOf(units.size())), Placeholder.unparsed("title", listing.title())));
            }
            showListings(player, context);
        });
    }

    /** Left click: the item in hand becomes the exact sample. Right click: back to matching by key. */
    private void setSample(Player player, PanelContext context, PanelListing listing, boolean fromHand) {
        ShopPanelRepository panel = plugin.shopPanel();
        if (panel == null) {
            return;
        }
        Messages messages = plugin.messages();
        byte[] sample = null;
        if (fromHand) {
            ItemStack hand = player.getInventory().getItemInMainHand();
            if (hand.isEmpty()) {
                player.sendMessage(messages.get("item.empty-hand"));
                return;
            }
            String key = plugin.itemIdentity().identify(hand).key();
            if (!key.equals(listing.itemKey())) {
                player.sendMessage(messages.get("panel.listing.sample-wrong-item",
                        Placeholder.unparsed("key", key), Placeholder.unparsed("expected", listing.itemKey())));
                return;
            }
            sample = hand.asOne().serializeAsBytes();
        }
        byte[] newSample = sample;
        UUID playerId = player.getUniqueId();
        boolean admin = Perm.ADMIN_BYPASS.has(player);
        kit.async(player, () -> panel.setSample(listing.id(), context.shop().id(), playerId, admin, newSample), changed -> {
            player.sendMessage(messages.get(!changed ? "computer.failed"
                    : newSample == null ? "panel.listing.sample-cleared" : "panel.listing.sample-set",
                    Placeholder.unparsed("title", listing.title())));
            showListings(player, context);
        });
    }

    /** config.yml settings.product-title.min/max, inside what the database accepts (3-60). */
    private int titleMin() {
        return Math.clamp(plugin.getConfig().getInt("settings.product-title.min", 3), 3, 60);
    }

    private int titleMax() {
        return Math.clamp(plugin.getConfig().getInt("settings.product-title.max", 60), titleMin(), 60);
    }

    private DepositableListing depositable(PanelContext context, PanelListing listing) {
        return new DepositableListing(listing.id(), listing.title(), context.shop().name(), listing.itemKey(),
                listing.material(), listing.unitAmount(), listing.unitPrice(), listing.available(),
                listing.matchMode(), listing.sample());
    }

    private ItemStack listingIcon(PanelListing listing, Messages messages, List<String> lore) {
        Material material = Material.matchMaterial(listing.material());
        ItemStack icon = new ItemStack(material != null && material.isItem() ? material : Material.PAPER);
        return Icons.decorate(icon, messages, "panel.listing.name", lore, listingTags(listing));
    }

    private ItemStack sampleIcon(PanelListing listing, Messages messages) {
        try {
            ItemStack sample = ItemStack.deserializeBytes(listing.sample());
            sample.editMeta(meta -> {
                List<Component> lore = meta.hasLore() ? new ArrayList<>(meta.lore()) : new ArrayList<>();
                lore.add(messages.plain("panel.listing.sample-label").decoration(TextDecoration.ITALIC, false));
                meta.lore(lore);
            });
            return sample;
        } catch (RuntimeException e) {
            return Icons.decorate(menu.icon("listing.sample-broken", Material.STRUCTURE_VOID), messages,
                    "panel.listing.sample-broken", List.of());
        }
    }

    private TagResolver listingTags(PanelListing listing) {
        var economy = plugin.economy();
        String price = economy == null ? listing.unitPrice().toPlainString() : economy.format(listing.unitPrice().doubleValue());
        return TagResolver.resolver(
                Placeholder.unparsed("title", listing.title()),
                Placeholder.unparsed("key", listing.itemKey()),
                Placeholder.unparsed("amount", String.valueOf(listing.unitAmount())),
                Placeholder.unparsed("price", price),
                Placeholder.unparsed("available", String.valueOf(listing.available())),
                Placeholder.unparsed("reserved", String.valueOf(listing.reserved())),
                Placeholder.component("mode", plugin.messages().plain(listing.exact() ? "panel.listing.mode-exact" : "panel.listing.mode-key")),
                Placeholder.unparsed("status", listing.status()));
    }
}
