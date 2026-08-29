import type { PreparedCheckout } from "@liteshop/core";
import type { CheckoutCartData } from "./checkout-cart-data.ts";

function groszeToZl(grosze: number): number {
  return grosze / 100;
}

export function toCheckoutCartData(prepared: PreparedCheckout): CheckoutCartData {
  return {
    products: prepared.lines.map((line) => ({
      name: line.name,
      sku: line.sku,
      quantity: line.quantity,
      price: groszeToZl(line.unitPrice),
    })),
    totalPrice: groszeToZl(prepared.total),
  };
}
