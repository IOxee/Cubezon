import { fmt, m } from "@/i18n";
import type { CheckoutProblem } from "@/lib/cart";
import { formatMoney } from "@/lib/format";

/** Text for a line that cannot be ordered (checkout page and placeOrder errors). */
export function checkoutProblemText(problem: CheckoutProblem): string {
  const t = m.shopping.checkout.problems;
  switch (problem.reason) {
    case "price_changed":
      return fmt(t.price_changed, { price: formatMoney(problem.unitPrice) });
    default:
      return t[problem.reason];
  }
}
