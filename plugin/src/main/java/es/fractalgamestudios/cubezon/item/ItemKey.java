package es.fractalgamestudios.cubezon.item;

/**
 * What an item is, independent of the plugin or mod that made it.
 *
 * @param key          namespaced key stored in listings.item_key (e.g. minecraft:diamond, nexo:ruby)
 * @param source       what recognised it (vanilla, itemsadder, mmoitems, pdc:nexo:id...)
 * @param baseMaterial vanilla id of the underlying item, for icons and categories (barrier for mod items)
 */
public record ItemKey(String key, String source, String baseMaterial) {

    public boolean custom() {
        return !key.startsWith("minecraft:");
    }
}
