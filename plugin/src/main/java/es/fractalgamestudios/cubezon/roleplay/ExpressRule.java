package es.fractalgamestudios.cubezon.roleplay;

/** Roleplay mode: which accepted orders have to be carried by hand. */
public final class ExpressRule {

    private ExpressRule() {
    }

    /**
     * Locker orders always need a courier. Express (mailbox) orders arrive on their own when the shop accepts
     * them, unless config.yml mailbox.express.hand-delivery is on: then they are carried to the mailbox too.
     */
    public static boolean needsCourier(boolean toMailbox, boolean handDelivery) {
        return !toMailbox || handDelivery;
    }
}
