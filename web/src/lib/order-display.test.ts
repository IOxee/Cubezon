import { describe, expect, it } from "vitest";
import { m } from "@/i18n";
import {
  failureReasonText,
  isCancelled,
  isProcessing,
  orderStampLabel,
  orderStatusHelp,
  orderStatusLabel,
  orderStepLabel,
  parseOrdersMode,
  sellerPayout,
} from "./order-display";

describe("isProcessing", () => {
  it("is true only for a PENDING order the plugin has claimed", () => {
    expect(isProcessing({ status: "PENDING", processingStartedAt: "2026-10-09T16:00:00Z" })).toBe(true);
    expect(isProcessing({ status: "PENDING", processingStartedAt: null })).toBe(false);
    expect(isProcessing({ status: "PAID", processingStartedAt: "2026-10-09T16:00:00Z" })).toBe(false);
  });
});

describe("parseOrdersMode", () => {
  it("reads roleplay and treats anything else (or no row) as automatic", () => {
    expect(parseOrdersMode("roleplay")).toBe("roleplay");
    expect(parseOrdersMode(" ROLEPLAY ")).toBe("roleplay");
    expect(parseOrdersMode("automatic")).toBe("automatic");
    expect(parseOrdersMode("something")).toBe("automatic");
    expect(parseOrdersMode(undefined)).toBe("automatic");
    expect(parseOrdersMode(null)).toBe("automatic");
  });
});

describe("order texts by mode", () => {
  it("keeps the usual texts by default and in automatic mode", () => {
    expect(orderStatusLabel("PENDING")).toBe(m.status.order.PENDING);
    expect(orderStatusLabel("PAID", { mode: "automatic" })).toBe(m.status.order.PAID);
    expect(orderStampLabel("PENDING")).toBe(m.status.orderStamp.PENDING);
    expect(orderStatusHelp("PAID")).toBe(m.status.orderHelp.PAID);
    expect(orderStepLabel("PAID")).toBe(m.account.order.steps.PAID);
  });

  it("waits for the shop and prepares the order in roleplay mode", () => {
    expect(orderStatusLabel("PENDING", { mode: "roleplay" })).toBe("Esperando a la tienda");
    expect(orderStatusLabel("PAID", { mode: "roleplay" })).toBe("Aceptado, en preparación");
    expect(orderStampLabel("PAID", { mode: "roleplay" })).toBe("En preparación");
    expect(orderStampLabel("PENDING", { mode: "roleplay" })).toBe(m.roleplay.status.stamp.PENDING);
    expect(orderStatusHelp("PENDING", { mode: "roleplay" })).toContain("aceptar");
    expect(orderStepLabel("READY", "roleplay")).toBe(m.roleplay.status.steps.READY);
  });

  it("leaves the other statuses as they are in roleplay mode", () => {
    for (const status of ["READY", "COLLECTED", "FAILED", "REFUNDED"] as const) {
      expect(orderStatusLabel(status, { mode: "roleplay" })).toBe(m.status.order[status]);
      expect(orderStampLabel(status, { mode: "roleplay" })).toBe(m.status.orderStamp[status]);
      expect(orderStatusHelp(status, { mode: "roleplay" })).toBe(m.status.orderHelp[status]);
    }
    expect(orderStepLabel("COLLECTED", "roleplay")).toBe(m.account.order.steps.COLLECTED);
  });

  it("shows a PENDING order being charged as processing in both modes", () => {
    for (const mode of ["automatic", "roleplay"] as const) {
      expect(orderStatusLabel("PENDING", { processing: true, mode })).toBe(m.status.processing);
      expect(orderStampLabel("PENDING", { processing: true, mode })).toBe(m.status.processingStamp);
    }
    expect(orderStatusHelp("PENDING", { processing: true })).toBe(m.status.processingHelp);
    expect(orderStatusHelp("PENDING", { processing: true, mode: "roleplay" })).toBe(m.roleplay.status.processingHelp);
  });
});

describe("failureReasonText", () => {
  it("translates the plugin codes and keeps unknown ones visible", () => {
    expect(failureReasonText("INSUFFICIENT_FUNDS")).toContain("saldo");
    expect(failureReasonText("SOMETHING_NEW")).toContain("SOMETHING_NEW");
    expect(failureReasonText(null)).toBeNull();
  });

  it("translates the roleplay codes", () => {
    expect(failureReasonText("SHOP_REJECTED")).toBe(m.roleplay.failureReason.SHOP_REJECTED);
    expect(failureReasonText("EXPIRED")).toBe(m.roleplay.failureReason.EXPIRED);
    expect(failureReasonText("DELIVERY_EXPIRED")).toBe(m.roleplay.failureReason.DELIVERY_EXPIRED);
    expect(failureReasonText("DELIVERY_EXPIRED")).toContain("devuelto");
    expect(failureReasonText("INVALID_TIP")).toBe(m.roleplay.failureReason.INVALID_TIP);
  });
});

describe("sellerPayout", () => {
  it("is paid once seller_paid_at is set", () => {
    expect(sellerPayout({ status: "READY", sellerPaidAt: "2026-10-09T18:00:00Z" })).toBe("paid");
    expect(sellerPayout({ status: "PAID", sellerPaidAt: "2026-10-09T18:00:00Z" })).toBe("paid");
  });

  it("is pending while a sold order has not been paid out (held in roleplay, or a retry)", () => {
    expect(sellerPayout({ status: "PAID", sellerPaidAt: null })).toBe("pending");
    expect(sellerPayout({ status: "READY", sellerPaidAt: null })).toBe("pending");
    expect(sellerPayout({ status: "COLLECTED", sellerPaidAt: null })).toBe("pending");
  });

  it("is none when nothing is due", () => {
    expect(sellerPayout({ status: "PENDING", sellerPaidAt: null })).toBe("none");
    expect(sellerPayout({ status: "FAILED", sellerPaidAt: null })).toBe("none");
    expect(sellerPayout({ status: "REFUNDED", sellerPaidAt: null })).toBe("none");
  });
});

describe("cancelled orders", () => {
  it("treats only FAILED orders the shop rejected or nobody accepted as cancelled", () => {
    expect(isCancelled({ status: "FAILED", failureReason: "SHOP_REJECTED" })).toBe(true);
    expect(isCancelled({ status: "FAILED", failureReason: "EXPIRED" })).toBe(true);
    expect(isCancelled({ status: "FAILED", failureReason: "INSUFFICIENT_FUNDS" })).toBe(false);
    expect(isCancelled({ status: "FAILED", failureReason: null })).toBe(false);
    expect(isCancelled({ status: "REFUNDED", failureReason: "DELIVERY_EXPIRED" })).toBe(false);
  });

  it("reads Cancelado instead of Fallido, in both modes", () => {
    for (const mode of ["automatic", "roleplay"] as const) {
      const options = { mode, failureReason: "SHOP_REJECTED" };
      expect(orderStampLabel("FAILED", options)).toBe(m.status.cancelled.stamp);
      expect(orderStatusLabel("FAILED", options)).toBe(m.status.cancelled.order);
      expect(orderStatusHelp("FAILED", options)).toBe(m.status.cancelled.help);
      expect(orderStepLabel("FAILED", mode, "EXPIRED")).toBe(m.status.cancelled.order);
    }
    expect(orderStampLabel("FAILED", { failureReason: "PAYMENT_ERROR" })).toBe(m.status.orderStamp.FAILED);
    expect(orderStepLabel("FAILED", "roleplay", "PAYMENT_ERROR")).toBe(m.account.order.steps.FAILED);
  });
});
