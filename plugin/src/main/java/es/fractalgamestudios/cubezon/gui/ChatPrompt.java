package es.fractalgamestudios.cubezon.gui;

import es.fractalgamestudios.cubezon.i18n.Messages;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.IntConsumer;
import java.util.function.Supplier;

/**
 * Asks a player something in chat (an amount, a price, a name). The answer is taken out of public
 * chat and the action runs on the main thread. A question expires after a while or when the player
 * writes "cancelar" / "cancel"; an invalid answer cancels it with a message saying what was expected.
 */
public final class ChatPrompt implements Listener {

    /** Highest price accepted (numeric(14, 2) in the database). */
    private static final BigDecimal MAX_PRICE = new BigDecimal("999999999999.99");

    /** {@code parse} turns the answer into the action to run, or null if the answer is invalid. */
    private record Pending(Function<String, @Nullable Runnable> parse, String invalidKey, TagResolver tags, long expiresAt) {
    }

    private final Plugin plugin;
    private final Supplier<Messages> messages;
    private final Sounds sounds;
    private final Map<UUID, Pending> pending = new ConcurrentHashMap<>();

    public ChatPrompt(Plugin plugin, Supplier<Messages> messages, Sounds sounds) {
        this.plugin = plugin;
        this.messages = messages;
        this.sounds = sounds;
    }

    /** config.yml settings.prompt.timeout-seconds (10 to 600). */
    private long timeoutMillis() {
        return 1000L * Math.clamp(plugin.getConfig().getLong("settings.prompt.timeout-seconds", 60), 10, 600);
    }

    /** config.yml settings.prompt.cancel-words. */
    private Set<String> cancelWords() {
        List<String> words = plugin.getConfig().getStringList("settings.prompt.cancel-words");
        return words.isEmpty() ? Set.of("cancelar", "cancel")
                : words.stream().map(word -> word.toLowerCase(Locale.ROOT)).collect(java.util.stream.Collectors.toSet());
    }

    /** A whole number from 1 to {@code max}; {@code question} is a language key with &lt;max&gt;. */
    public void askAmount(Player player, String question, int max, IntConsumer action) {
        if (max < 1) {
            return;
        }
        TagResolver tags = Placeholder.unparsed("max", String.valueOf(max));
        ask(player, question, "prompt.invalid", tags, answer -> {
            int amount = parse(answer, max);
            return amount < 1 ? null : () -> action.accept(amount);
        });
    }

    /** A price above 0 with up to two decimals ("12,5" or "12.50"). */
    public void askPrice(Player player, String question, Consumer<BigDecimal> action) {
        ask(player, question, "prompt.invalid-price", TagResolver.empty(), answer -> {
            BigDecimal price = parsePrice(answer);
            return price == null ? null : () -> action.accept(price);
        });
    }

    /** A text between {@code min} and {@code max} characters. */
    public void askText(Player player, String question, int min, int max, Consumer<String> action) {
        TagResolver tags = TagResolver.resolver(Placeholder.unparsed("min", String.valueOf(min)),
                Placeholder.unparsed("max", String.valueOf(max)));
        ask(player, question, "prompt.invalid-text", tags, answer -> {
            String text = answer.strip();
            return text.length() < min || text.length() > max ? null : () -> action.accept(text);
        });
    }

    /** Main thread. Closes the player's menu and asks. */
    private void ask(Player player, String question, String invalidKey, TagResolver tags,
                     Function<String, @Nullable Runnable> parse) {
        pending.put(player.getUniqueId(), new Pending(parse, invalidKey, tags, System.currentTimeMillis() + timeoutMillis()));
        player.closeInventory();
        sounds.play(player, Sounds.Event.PROMPT);
        player.sendMessage(messages.get().get(question, tags));
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onChat(AsyncChatEvent event) {
        Player player = event.getPlayer();
        Pending question = pending.remove(player.getUniqueId());
        if (question == null) {
            return;
        }
        event.setCancelled(true);
        Messages texts = messages.get();
        if (System.currentTimeMillis() > question.expiresAt()) {
            player.sendMessage(texts.get("prompt.expired"));
            return;
        }
        String answer = PlainTextComponentSerializer.plainText().serialize(event.message()).strip();
        if (cancelWords().contains(answer.toLowerCase(Locale.ROOT))) {
            player.sendMessage(texts.get("prompt.cancelled"));
            return;
        }
        Runnable action = question.parse().apply(answer);
        if (action == null) {
            player.sendMessage(texts.get(question.invalidKey(), question.tags()));
            sounds.play(player, Sounds.Event.ERROR);
            return;
        }
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            if (player.isOnline()) {
                action.run();
            }
        });
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        pending.remove(event.getPlayer().getUniqueId());
    }

    /** The number written, if it is between 1 and max; otherwise -1. */
    static int parse(String answer, int max) {
        try {
            int amount = Integer.parseInt(answer.strip());
            return amount >= 1 && amount <= max ? amount : -1;
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /** A positive price with at most two decimals; a comma works as the decimal mark. Null if invalid. */
    static @Nullable BigDecimal parsePrice(String answer) {
        String normalized = answer.strip().replace(',', '.');
        if (!normalized.matches("^\\d{1,12}(\\.\\d{1,2})?$")) {
            return null;
        }
        BigDecimal price = new BigDecimal(normalized).setScale(2, RoundingMode.UNNECESSARY);
        return price.signum() > 0 && price.compareTo(MAX_PRICE) <= 0 ? price : null;
    }
}
