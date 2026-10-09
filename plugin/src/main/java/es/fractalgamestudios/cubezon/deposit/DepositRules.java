package es.fractalgamestudios.cubezon.deposit;

/** How deposited items become units of a listing. */
public final class DepositRules {

    /** Units formed from a pile of identical items, and what is left over. */
    public record Split(int units, int remainder) {
    }

    private DepositRules() {
    }

    /** Items count for a listing when they have its item key (minecraft:diamond, nexo:ruby...). */
    public static boolean matchesKey(String listingKey, String itemKey) {
        return listingKey.equals(itemKey);
    }

    /** A unit is stored as a single ItemStack, so it cannot be bigger than the item's max stack size. */
    public static boolean unitFitsInOneStack(int unitAmount, int maxStackSize) {
        return unitAmount >= 1 && unitAmount <= maxStackSize;
    }

    /** Splits a pile of identical items into units: 64 diamonds with a unit of 16 are 4 units, 0 left. */
    public static Split split(int totalAmount, int unitAmount) {
        if (unitAmount < 1) {
            throw new IllegalArgumentException("unitAmount must be positive: " + unitAmount);
        }
        return new Split(totalAmount / unitAmount, totalAmount % unitAmount);
    }
}
