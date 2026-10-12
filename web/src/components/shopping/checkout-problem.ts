import { fmt, type Messages } from "@/i18n";
import type { CheckoutProblem } from "@/lib/cart";
import type { Format } from "@/lib/format";

/** Text for a line that cannot be ordered (checkout page and placeOrder errors). */
export function checkoutProblemText(m: Messages, f: Format, problem: CheckoutProblem): string {
  const t = m.shopping.checkout.problems;
  switch (problem.reason) {
    case "price_changed":
      return fmt(t.price_changed, { price: f.money(problem.unitPrice) });
    default:
      return t[problem.reason];
  }
}
