package es.fractalgamestudios.cubezon.roleplay;

import org.jetbrains.annotations.Nullable;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** An order as the shop sees it on its computer. */
public record ShopOrderView(
        UUID id,
        String status,
        boolean processing,
        String title,
        String material,
        UUID buyerId,
        String buyerName,
        int quantity,
        BigDecimal total,
        @Nullable UUID lockerId,
        String lockerName,
        OffsetDateTime createdAt,
        @Nullable OffsetDateTime paidAt,
        String deliveryMethod,
        @Nullable String mailboxPosition) {

    /** Express order: delivered straight to the buyer's mailbox, no package. */
    public boolean toMailbox() {
        return "MAILBOX".equals(deliveryMethod);
    }

    /** Waiting for the shop to accept or reject it (and nobody is accepting it right now). */
    public boolean awaitingDecision() {
        return "PENDING".equals(status) && !processing;
    }

    /** Accepted and charged: a package must be carried to the locker. */
    public boolean accepted() {
        return "PAID".equals(status);
    }
}
