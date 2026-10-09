package es.fractalgamestudios.cubezon.gui;

import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.ArrayList;
import java.util.List;

/** Menu icons with names and lore taken from the language file. */
public final class Icons {

    private Icons() {
    }

    /** Icon named {@code <key>.name} with the given lore keys, all from the language file. */
    public static ItemStack of(Material material, Messages messages, String nameKey, List<String> loreKeys,
                               TagResolver... tags) {
        return decorate(new ItemStack(material), messages, nameKey, loreKeys, tags);
    }

    public static ItemStack head(OfflinePlayer player, Messages messages, String nameKey, List<String> loreKeys,
                                 TagResolver... tags) {
        ItemStack head = new ItemStack(Material.PLAYER_HEAD);
        head.editMeta(SkullMeta.class, meta -> meta.setOwningPlayer(player));
        return decorate(head, messages, nameKey, loreKeys, tags);
    }

    public static ItemStack decorate(ItemStack item, Messages messages, String nameKey, List<String> loreKeys,
                                     TagResolver... tags) {
        item.editMeta(meta -> {
            meta.displayName(plain(messages, nameKey, tags));
            List<Component> lore = new ArrayList<>();
            for (String key : loreKeys) {
                lore.add(plain(messages, key, tags));
            }
            meta.lore(lore);
            meta.addItemFlags(ItemFlag.values());
        });
        return item;
    }

    private static Component plain(Messages messages, String key, TagResolver... tags) {
        return messages.plain(key, tags).decoration(TextDecoration.ITALIC, false);
    }
}
