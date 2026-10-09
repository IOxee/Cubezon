package es.fractalgamestudios.cubezon.storage;

import es.fractalgamestudios.cubezon.i18n.Messages;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.NamespacedKey;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.Nullable;

import java.util.List;
import java.util.Optional;

/**
 * A storage block item: the block of its {@link StorageType}, named and tagged with the type id,
 * so the same block without the tag (or renamed in an anvil) never counts as storage.
 */
public final class StorageItem {

    private final NamespacedKey typeKey;
    /** Items made before storage types existed: a BYTE tag, always the default barrel type. */
    private final NamespacedKey legacyKey;

    public StorageItem(Plugin plugin) {
        this.typeKey = new NamespacedKey(plugin, "storage_type");
        this.legacyKey = new NamespacedKey(plugin, "storage_block");
    }

    public ItemStack create(StorageType type, int amount, Messages messages) {
        ItemStack item = new ItemStack(type.material(), amount);
        item.editMeta(meta -> {
            TagResolver[] tags = {
                    Placeholder.unparsed("name", type.displayName()),
                    Placeholder.unparsed("capacity", String.valueOf(type.capacity()))};
            meta.displayName(messages.plain("storage.typed-item.name", tags).decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(
                    messages.plain("storage.typed-item.lore-1", tags).decoration(TextDecoration.ITALIC, false),
                    messages.plain("storage.typed-item.lore-2", tags).decoration(TextDecoration.ITALIC, false)));
            meta.getPersistentDataContainer().set(typeKey, PersistentDataType.STRING, type.id());
        });
        return item;
    }

    /** The storage type id of the item, if it is a storage item. */
    public Optional<String> typeOf(@Nullable ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return Optional.empty();
        }
        PersistentDataContainer data = item.getItemMeta().getPersistentDataContainer();
        String type = data.get(typeKey, PersistentDataType.STRING);
        if (type != null) {
            return Optional.of(type);
        }
        return data.has(legacyKey, PersistentDataType.BYTE) ? Optional.of(StorageType.DEFAULT_ID) : Optional.empty();
    }

    public boolean isStorageItem(@Nullable ItemStack item) {
        return typeOf(item).isPresent();
    }
}
