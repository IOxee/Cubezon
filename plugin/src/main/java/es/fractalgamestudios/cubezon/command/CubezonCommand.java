package es.fractalgamestudios.cubezon.command;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.suggestion.Suggestions;
import com.mojang.brigadier.suggestion.SuggestionsBuilder;
import es.fractalgamestudios.cubezon.CubezonPlugin;
import es.fractalgamestudios.cubezon.storage.StorageController;
import es.fractalgamestudios.cubezon.storage.StorageType;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import io.papermc.paper.command.brigadier.argument.ArgumentTypes;
import io.papermc.paper.command.brigadier.argument.resolvers.selector.PlayerSelectorArgumentResolver;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.sql.SQLException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.logging.Level;

/** /cubezon (alias /cz) and its subcommands. */
public final class CubezonCommand {

    private final CubezonPlugin plugin;

    public CubezonCommand(CubezonPlugin plugin) {
        this.plugin = plugin;
    }

    public void register(Commands commands) {
        var root = Commands.literal("cubezon")
                .requires(source -> Perm.USE.has(source.getSender()))
                .executes(this::help)
                .then(Commands.literal("help").executes(this::help))
                .then(Commands.literal("link")
                        .requires(source -> Perm.LINK.has(source.getSender()))
                        .executes(this::link))
                .then(Commands.literal("deposit")
                        .requires(source -> Perm.DEPOSIT.has(source.getSender()))
                        .executes(this::deposit))
                .then(Commands.literal("pickup")
                        .requires(source -> Perm.PICKUP.has(source.getSender()))
                        .executes(this::pickup))
                .then(itemCommand("item", "info", "register"))
                .then(mailboxCommand())
                .then(computerCommand("computer", "buy", "give"))
                .then(employeeCommand("employee", "add", "remove", "list"))
                .then(storageCommand("storage", "buy", "give", "type", "create", "remove", "list"))
                .then(shopCommand("shop"))
                .then(lockerCommand("locker", "create", "remove", "list"))
                .then(Commands.literal("reload")
                        .requires(source -> Perm.ADMIN_RELOAD.has(source.getSender()))
                        .executes(guard(Perm.ADMIN_RELOAD, this::reload)));

        commands.register(root.build(), "Cubezon marketplace", List.of("cz"));
    }

    /** Item in hand: its key (anyone) or registering it in the web catalog (admin). */
    private LiteralArgumentBuilder<CommandSourceStack> itemCommand(String root, String info, String register) {
        return Commands.literal(root)
                .then(Commands.literal(info)
                        .executes(context -> withPlayer(context, player -> plugin.itemController().info(player))))
                .then(Commands.literal(register)
                        .requires(source -> Perm.ADMIN_ITEM.has(source.getSender()))
                        .executes(guard(Perm.ADMIN_ITEM, context -> withPlayer(context, player -> plugin.itemController().register(player)))));
    }

    /** /cz mailbox: where your mailbox is; buy (any player) and give (admin). */
    private LiteralArgumentBuilder<CommandSourceStack> mailboxCommand() {
        return Commands.literal("mailbox")
                .executes(context -> withPlayer(context, player -> plugin.mailboxController().info(player)))
                .then(Commands.literal("buy")
                        .requires(source -> Perm.BUY_MAILBOX.has(source.getSender()))
                        .executes(context -> withPlayer(context, player -> plugin.mailboxController().buy(player, 1)))
                        .then(Commands.argument("amount", IntegerArgumentType.integer(1, StorageController.MAX_AMOUNT))
                                .executes(context -> withPlayer(context, player -> plugin.mailboxController()
                                        .buy(player, IntegerArgumentType.getInteger(context, "amount"))))))
                .then(Commands.literal("give")
                        .requires(source -> Perm.ADMIN_GIVE.has(source.getSender()))
                        .then(Commands.argument("player", ArgumentTypes.player())
                                .executes(guard(Perm.ADMIN_GIVE, context -> giveMailbox(context, 1)))
                                .then(Commands.argument("amount", IntegerArgumentType.integer(1, StorageController.MAX_AMOUNT))
                                        .executes(guard(Perm.ADMIN_GIVE, context -> giveMailbox(context, IntegerArgumentType.getInteger(context, "amount")))))));
    }

    private int giveMailbox(CommandContext<CommandSourceStack> context, int amount) throws CommandSyntaxException {
        Player target = context.getArgument("player", PlayerSelectorArgumentResolver.class)
                .resolve(context.getSource()).getFirst();
        plugin.mailboxController().give(context.getSource().getSender(), target, amount);
        return Command.SINGLE_SUCCESS;
    }

    /** Company computer: buy (any player) and give (admin). */
    private LiteralArgumentBuilder<CommandSourceStack> computerCommand(String root, String buy, String give) {
        return Commands.literal(root)
                .then(Commands.literal(buy)
                        .requires(source -> Perm.BUY_COMPUTER.has(source.getSender()))
                        .executes(context -> withPlayer(context, player -> plugin.roleplayController().buy(player, 1)))
                        .then(Commands.argument("amount", IntegerArgumentType.integer(1, StorageController.MAX_AMOUNT))
                                .executes(context -> withPlayer(context, player -> plugin.roleplayController()
                                        .buy(player, IntegerArgumentType.getInteger(context, "amount"))))))
                .then(Commands.literal(give)
                        .requires(source -> Perm.ADMIN_GIVE.has(source.getSender()))
                        .then(Commands.argument("player", ArgumentTypes.player())
                                .executes(guard(Perm.ADMIN_GIVE, context -> giveComputer(context, 1)))
                                .then(Commands.argument("amount", IntegerArgumentType.integer(1, StorageController.MAX_AMOUNT))
                                        .executes(guard(Perm.ADMIN_GIVE, context -> giveComputer(context,
                                                IntegerArgumentType.getInteger(context, "amount")))))));
    }

    private int giveComputer(CommandContext<CommandSourceStack> context, int amount) throws CommandSyntaxException {
        Player target = context.getArgument("player", PlayerSelectorArgumentResolver.class)
                .resolve(context.getSource()).getFirst();
        plugin.roleplayController().give(context.getSource().getSender(), target, amount);
        return Command.SINGLE_SUCCESS;
    }

    /** Shop employees (who may use the company computer). Owner of the shop or admin. */
    private LiteralArgumentBuilder<CommandSourceStack> employeeCommand(String root, String add, String remove, String list) {
        return Commands.literal(root)
                .then(Commands.literal(add)
                        .then(Commands.argument("shop", StringArgumentType.word())
                                .suggests(this::suggestSlugs)
                                .then(Commands.argument("player", StringArgumentType.word())
                                        .suggests(this::suggestOnlinePlayers)
                                        .executes(context -> withPlayer(context, player -> plugin.roleplayController().addMember(player,
                                                StringArgumentType.getString(context, "shop"),
                                                StringArgumentType.getString(context, "player")))))))
                .then(Commands.literal(remove)
                        .then(Commands.argument("shop", StringArgumentType.word())
                                .suggests(this::suggestSlugs)
                                .then(Commands.argument("player", StringArgumentType.word())
                                        .suggests(this::suggestOnlinePlayers)
                                        .executes(context -> withPlayer(context, player -> plugin.roleplayController().removeMember(player,
                                                StringArgumentType.getString(context, "shop"),
                                                StringArgumentType.getString(context, "player")))))))
                .then(Commands.literal(list)
                        .then(Commands.argument("shop", StringArgumentType.word())
                                .suggests(this::suggestSlugs)
                                .executes(context -> withPlayer(context, player -> plugin.roleplayController().listMembers(player,
                                        StringArgumentType.getString(context, "shop"))))));
    }

    private CompletableFuture<Suggestions> suggestSlugs(CommandContext<CommandSourceStack> context, SuggestionsBuilder builder) {
        return plugin.storageController().suggestSlugs(builder.getRemainingLowerCase())
                .thenApply(slugs -> {
                    slugs.forEach(builder::suggest);
                    return builder.build();
                });
    }

    private CompletableFuture<Suggestions> suggestOnlinePlayers(CommandContext<CommandSourceStack> context,
                                                                SuggestionsBuilder builder) {
        plugin.getServer().getOnlinePlayers().stream()
                .map(Player::getName)
                .filter(name -> name.toLowerCase().startsWith(builder.getRemainingLowerCase()))
                .forEach(builder::suggest);
        return builder.buildFuture();
    }

    /** Storage info (any player), buy a type (any player), give and manage types (admin). */
    private LiteralArgumentBuilder<CommandSourceStack> storageCommand(String root, String buy, String give, String type,
                                                                      String create, String remove, String list) {
        return Commands.literal(root)
                .executes(context -> withPlayer(context, player -> plugin.storageController().info(player)))
                .then(Commands.literal(buy)
                        .requires(source -> Perm.BUY_STORAGE.has(source.getSender()))
                        .executes(context -> withPlayer(context, player -> plugin.storageController().buy(player, null, 1)))
                        .then(Commands.argument("type", StringArgumentType.word())
                                .suggests(this::suggestStorageTypes)
                                .executes(context -> withPlayer(context, player -> plugin.storageController()
                                        .buy(player, StringArgumentType.getString(context, "type"), 1)))
                                .then(Commands.argument("amount", IntegerArgumentType.integer(1, StorageController.MAX_AMOUNT))
                                        .executes(context -> withPlayer(context, player -> plugin.storageController().buy(player,
                                                StringArgumentType.getString(context, "type"),
                                                IntegerArgumentType.getInteger(context, "amount")))))))
                .then(Commands.literal(give)
                        .requires(source -> Perm.ADMIN_GIVE.has(source.getSender()))
                        .then(Commands.argument("player", ArgumentTypes.player())
                                .executes(guard(Perm.ADMIN_GIVE, context -> giveStorage(context, null, 1)))
                                .then(Commands.argument("type", StringArgumentType.word())
                                        .suggests(this::suggestStorageTypes)
                                        .executes(guard(Perm.ADMIN_GIVE, context -> giveStorage(context, StringArgumentType.getString(context, "type"), 1)))
                                        .then(Commands.argument("amount", IntegerArgumentType.integer(1, StorageController.MAX_AMOUNT))
                                                .executes(guard(Perm.ADMIN_GIVE, context -> giveStorage(context, StringArgumentType.getString(context, "type"),
                                                        IntegerArgumentType.getInteger(context, "amount"))))))))
                .then(Commands.literal(type)
                        .requires(source -> Perm.ADMIN_STORAGE_TYPES.has(source.getSender()))
                        .then(Commands.literal(create)
                                .then(Commands.argument("id", StringArgumentType.word())
                                        .then(Commands.argument("capacity", IntegerArgumentType.integer(1, 10000))
                                                .then(Commands.argument("price", DoubleArgumentType.doubleArg(0))
                                                        .executes(guard(Perm.ADMIN_STORAGE_TYPES, context -> createStorageType(context, null)))
                                                        .then(Commands.argument("name", StringArgumentType.greedyString())
                                                                .executes(guard(Perm.ADMIN_STORAGE_TYPES, context -> createStorageType(context,
                                                                        StringArgumentType.getString(context, "name")))))))))
                        .then(Commands.literal(remove)
                                .then(Commands.argument("id", StringArgumentType.word())
                                        .suggests(this::suggestStorageTypes)
                                        .executes(guard(Perm.ADMIN_STORAGE_TYPES, context -> {
                                            plugin.storageController().removeType(context.getSource().getSender(),
                                                    StringArgumentType.getString(context, "id"));
                                            return Command.SINGLE_SUCCESS;
                                        }))))
                        .then(Commands.literal(list)
                                .executes(guard(Perm.ADMIN_STORAGE_TYPES, context -> {
                                    plugin.storageController().listTypes(context.getSource().getSender());
                                    return Command.SINGLE_SUCCESS;
                                }))));
    }

    private int createStorageType(CommandContext<CommandSourceStack> context, String name) {
        return withPlayer(context, player -> plugin.storageController().createType(player,
                StringArgumentType.getString(context, "id"),
                IntegerArgumentType.getInteger(context, "capacity"),
                BigDecimal.valueOf(DoubleArgumentType.getDouble(context, "price")).setScale(2, RoundingMode.HALF_UP),
                name));
    }

    private CompletableFuture<Suggestions> suggestStorageTypes(CommandContext<CommandSourceStack> context,
                                                               SuggestionsBuilder builder) {
        plugin.storageController().types().stream()
                .map(StorageType::id)
                .filter(id -> id.startsWith(builder.getRemainingLowerCase()))
                .forEach(builder::suggest);
        return builder.buildFuture();
    }

    private int giveStorage(CommandContext<CommandSourceStack> context, String typeId, int amount) throws CommandSyntaxException {
        Player target = context.getArgument("player", PlayerSelectorArgumentResolver.class)
                .resolve(context.getSource()).getFirst();
        plugin.storageController().give(context.getSource().getSender(), target, typeId, amount);
        return Command.SINGLE_SUCCESS;
    }

    /**
     * Admin: /cz shop <slug or id> gives a zone wand for that shop; /cz shop settings slots <player> [n|reset]
     * shows or sets how many shops the player may have.
     */
    private LiteralArgumentBuilder<CommandSourceStack> shopCommand(String root) {
        return Commands.literal(root)
                .requires(source -> Perm.ADMIN_SHOP.has(source.getSender()))
                .then(Commands.literal("settings")
                        .then(Commands.literal("slots")
                                .then(Commands.argument("player", StringArgumentType.word())
                                        .suggests(this::suggestOnlinePlayers)
                                        .executes(guard(Perm.ADMIN_SHOP, context -> {
                                            plugin.shopSlotsController().show(context.getSource().getSender(),
                                                    StringArgumentType.getString(context, "player"));
                                            return Command.SINGLE_SUCCESS;
                                        }))
                                        .then(Commands.argument("value", StringArgumentType.word())
                                                .suggests((context, builder) -> {
                                                    builder.suggest("reset");
                                                    builder.suggest("1");
                                                    builder.suggest("2");
                                                    builder.suggest("3");
                                                    return builder.buildFuture();
                                                })
                                                .executes(guard(Perm.ADMIN_SHOP, context -> {
                                                    plugin.shopSlotsController().set(context.getSource().getSender(),
                                                            StringArgumentType.getString(context, "player"),
                                                            StringArgumentType.getString(context, "value"));
                                                    return Command.SINGLE_SUCCESS;
                                                }))))))
                .then(Commands.argument("shop", StringArgumentType.word())
                        .suggests((context, builder) -> plugin.storageController()
                                .suggestSlugs(builder.getRemainingLowerCase())
                                .thenApply(slugs -> {
                                    slugs.forEach(builder::suggest);
                                    return builder.build();
                                }))
                        .executes(guard(Perm.ADMIN_SHOP, context -> withPlayer(context, player -> plugin.storageController()
                                .startZone(player, StringArgumentType.getString(context, "shop"))))));
    }

    /**
     * Body of a command that needs {@code perm}. The node's requires() already hides the command from
     * whoever lacks it; this checks again when it runs, so a mistake in the command tree can never expose it.
     */
    private Command<CommandSourceStack> guard(Perm perm, Command<CommandSourceStack> action) {
        return context -> {
            CommandSender sender = context.getSource().getSender();
            if (!perm.has(sender)) {
                sender.sendMessage(plugin.messages().get("error.no-admin"));
                return 0;
            }
            return action.run(context);
        };
    }

    private int withPlayer(CommandContext<CommandSourceStack> context, Consumer<Player> action) {
        if (!(context.getSource().getSender() instanceof Player player)) {
            context.getSource().getSender().sendMessage(plugin.messages().get("link.players-only"));
            return 0;
        }
        action.accept(player);
        return Command.SINGLE_SUCCESS;
    }

    /** Admin locker management: create, remove (optionally moving its orders to another locker), list. */
    private LiteralArgumentBuilder<CommandSourceStack> lockerCommand(String root, String create, String remove, String list) {
        return Commands.literal(root)
                .requires(source -> Perm.ADMIN_LOCKER.has(source.getSender()))
                .then(Commands.literal(create)
                        .then(Commands.argument("name", StringArgumentType.word())
                                .executes(guard(Perm.ADMIN_LOCKER, context -> {
                                    if (!(context.getSource().getSender() instanceof Player player)) {
                                        context.getSource().getSender().sendMessage(plugin.messages().get("link.players-only"));
                                        return 0;
                                    }
                                    plugin.lockerController().create(player, StringArgumentType.getString(context, "name"));
                                    return Command.SINGLE_SUCCESS;
                                }))))
                .then(Commands.literal(remove)
                        .then(Commands.argument("name", StringArgumentType.word())
                                .suggests(this::suggestLockers)
                                .executes(guard(Perm.ADMIN_LOCKER, context -> {
                                    plugin.lockerController().remove(context.getSource().getSender(),
                                            StringArgumentType.getString(context, "name"), null);
                                    return Command.SINGLE_SUCCESS;
                                }))
                                .then(Commands.argument("moveTo", StringArgumentType.word())
                                        .suggests(this::suggestLockers)
                                        .executes(guard(Perm.ADMIN_LOCKER, context -> {
                                            plugin.lockerController().remove(context.getSource().getSender(),
                                                    StringArgumentType.getString(context, "name"),
                                                    StringArgumentType.getString(context, "moveTo"));
                                            return Command.SINGLE_SUCCESS;
                                        })))))
                .then(Commands.literal(list)
                        .executes(guard(Perm.ADMIN_LOCKER, context -> {
                            plugin.lockerController().list(context.getSource().getSender());
                            return Command.SINGLE_SUCCESS;
                        })));
    }

    private CompletableFuture<Suggestions> suggestLockers(CommandContext<CommandSourceStack> context,
                                                          SuggestionsBuilder builder) {
        plugin.lockerController().registry().names().stream()
                .filter(name -> name.toLowerCase().startsWith(builder.getRemainingLowerCase()))
                .forEach(builder::suggest);
        return builder.buildFuture();
    }

    private int help(CommandContext<CommandSourceStack> context) {
        CommandSender sender = context.getSource().getSender();
        var messages = plugin.messages();
        sender.sendMessage(messages.get("help.header"));
        sender.sendMessage(messages.plain("help.link"));
        sender.sendMessage(messages.plain("help.deposit"));
        sender.sendMessage(messages.plain("help.pickup"));
        sender.sendMessage(messages.plain("help.storage"));
        if (AdminAccess.has(sender)) {
            sender.sendMessage(messages.plain("help.storage-types"));
        }
        sender.sendMessage(messages.plain("help.item"));
        sender.sendMessage(messages.plain("help.mailbox"));
        sender.sendMessage(messages.plain("help.computer"));
        sender.sendMessage(messages.plain("help.employee"));
        if (AdminAccess.has(sender)) {
            sender.sendMessage(messages.plain("help.shop"));
            sender.sendMessage(messages.plain("help.shop-slots"));
            sender.sendMessage(messages.plain("help.storage-give"));
            sender.sendMessage(messages.plain("help.locker"));
            sender.sendMessage(messages.plain("help.reload"));
        }
        return Command.SINGLE_SUCCESS;
    }

    private int link(CommandContext<CommandSourceStack> context) {
        if (!(context.getSource().getSender() instanceof Player player)) {
            context.getSource().getSender().sendMessage(plugin.messages().get("link.players-only"));
            return 0;
        }
        var linkService = plugin.linkService();
        var messages = plugin.messages();
        UUID playerId = player.getUniqueId();
        String name = player.getName();
        // Database round trip: off the main thread. Adventure's sendMessage is thread-safe.
        plugin.dbExecutor().execute(() -> {
            try {
                String code = linkService.createCode(playerId, name);
                player.sendMessage(messages.get("link.code",
                        Placeholder.unparsed("code", code),
                        Placeholder.unparsed("minutes", String.valueOf(linkService.ttl().toMinutes()))));
            } catch (SQLException | RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Could not create a link code for " + name, e);
                player.sendMessage(messages.get("link.failed"));
            }
        });
        return Command.SINGLE_SUCCESS;
    }

    private int deposit(CommandContext<CommandSourceStack> context) {
        if (!(context.getSource().getSender() instanceof Player player)) {
            context.getSource().getSender().sendMessage(plugin.messages().get("link.players-only"));
            return 0;
        }
        plugin.depositController().openListings(player);
        return Command.SINGLE_SUCCESS;
    }

    private int pickup(CommandContext<CommandSourceStack> context) {
        if (!(context.getSource().getSender() instanceof Player player)) {
            context.getSource().getSender().sendMessage(plugin.messages().get("link.players-only"));
            return 0;
        }
        plugin.lockerController().pickupNearby(player);
        return Command.SINGLE_SUCCESS;
    }

    private int reload(CommandContext<CommandSourceStack> context) {
        boolean modeChanged = plugin.reload();
        context.getSource().getSender().sendMessage(plugin.messages().get("reload.done"));
        if (modeChanged) {
            context.getSource().getSender().sendMessage(plugin.messages().get("reload.mode-needs-restart",
                    Placeholder.unparsed("mode", plugin.orderMode().key())));
        }
        return Command.SINGLE_SUCCESS;
    }
}
