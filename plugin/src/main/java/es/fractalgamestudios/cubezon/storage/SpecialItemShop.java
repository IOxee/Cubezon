package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.ShapedRecipe;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.IntFunction;

/**
 * How players get a special Cubezon block (storage, company computer): bought with game money,
 * crafted, or given by an admin. Each way is configured under {@code <configPath>} in config.yml
 * and its texts live under {@code <messagePrefix>} in the language file.
 */
public final class SpecialItemShop {

    private final CubezonPlugin plugin;
    private final String configPath;
    private final String messagePrefix;
    private final NamespacedKey recipeKey;
    private final IntFunction<ItemStack> factory;

    public SpecialItemShop(CubezonPlugin plugin, String configPath, String messagePrefix, String recipeKey,
                           IntFunction<ItemStack> factory) {
        this.plugin = plugin;
        this.configPath = configPath;
        this.messagePrefix = messagePrefix;
        this.recipeKey = new NamespacedKey(plugin, recipeKey);
        this.factory = factory;
    }

    /** (Re)registers the crafting recipe from config.yml. Main thread. */
    public void registerRecipe() {
        plugin.getServer().removeRecipe(recipeKey);
        ConfigurationSection recipe = plugin.getConfig().getConfigurationSection(configPath + ".recipe");
        if (recipe == null || !recipe.getBoolean("enabled", false)) {
            return;
        }
        List<String> shape = recipe.getStringList("shape");
        ConfigurationSection ingredients = recipe.getConfigurationSection("ingredients");
        if (shape.isEmpty() || ingredients == null) {
            plugin.getLogger().warning(configPath + ".recipe is enabled but has no shape or ingredients; skipping.");
            return;
        }
        try {
            ShapedRecipe shaped = new ShapedRecipe(recipeKey, factory.apply(1));
            shaped.shape(shape.toArray(String[]::new));
            for (String symbol : ingredients.getKeys(false)) {
                Material material = Material.matchMaterial(ingredients.getString(symbol, ""));
                if (material == null || symbol.length() != 1) {
                    plugin.getLogger().warning("Invalid " + configPath + " recipe ingredient: " + symbol);
                    return;
                }
                shaped.setIngredient(symbol.charAt(0), material);
            }
            plugin.getServer().addRecipe(shaped);
        } catch (IllegalArgumentException e) {
            plugin.getLogger().warning("Invalid " + configPath + " recipe: " + e.getMessage());
        }
    }

    public void unregisterRecipe() {
        plugin.getServer().removeRecipe(recipeKey);
    }

    /** Main thread: Vault calls must not run async. */
    public void buy(Player player, int amount) {
        Messages messages = plugin.messages();
        if (!plugin.getConfig().getBoolean(configPath + ".buy.enabled", true)) {
            player.sendMessage(messages.get(messagePrefix + ".buy-disabled"));
            return;
        }
        Economy economy = plugin.economy();
        if (economy == null) {
            player.sendMessage(messages.get("error.economy-missing"));
            return;
        }
        BigDecimal unitPrice = BigDecimal.valueOf(plugin.getConfig().getDouble(configPath + ".buy.price", 1000));
        double total = unitPrice.multiply(BigDecimal.valueOf(amount)).doubleValue();
        TagResolver tags = TagResolver.resolver(
                Placeholder.unparsed("amount", String.valueOf(amount)),
                Placeholder.unparsed("price", economy.format(total)));
        if (!economy.has(player, total) || !economy.withdrawPlayer(player, total).transactionSuccess()) {
            player.sendMessage(messages.get(messagePrefix + ".not-enough-money", tags));
            return;
        }
        giveInStacks(player, amount, factory);
        player.sendMessage(messages.get(messagePrefix + ".bought", tags));
    }

    /** Admin give. */
    public void give(CommandSender sender, Player target, int amount) {
        giveInStacks(target, amount, factory);
        TagResolver amountTag = Placeholder.unparsed("amount", String.valueOf(amount));
        sender.sendMessage(plugin.messages().get(messagePrefix + ".given", amountTag,
                Placeholder.unparsed("player", target.getName())));
        if (sender != target) {
            target.sendMessage(plugin.messages().get(messagePrefix + ".received", amountTag));
        }
    }

    /** {@code amount} items made by {@code factory}, in stacks no bigger than the item's max stack size. */
    public static void giveInStacks(Player player, int amount, IntFunction<ItemStack> factory) {
        int maxStack = Math.max(1, factory.apply(1).getMaxStackSize());
        for (int left = amount; left > 0; left -= maxStack) {
            giveOrDrop(player, factory.apply(Math.min(left, maxStack)));
        }
    }

    /** Whatever does not fit in the inventory drops at the player's feet. */
    public static void giveOrDrop(Player player, ItemStack stack) {
        player.getInventory().addItem(stack).values()
                .forEach(leftover -> player.getWorld().dropItemNaturally(player.getLocation(), leftover));
    }
}
