import type { PreparedCheckout } from "@liteshop/core";
import type { CheckoutCartData } from "./checkout-cart-data.ts";
import { seedPaymentMethods, seedShippingMethods } from "./checkout-methods.ts";

function groszeToZl(grosze: number): number {
  return grosze / 100;
}

export function toCheckoutCartData(prepared: PreparedCheckout): CheckoutCartData {
  return {
    cart: {
      id: null,
      currency: prepared.currency,
      products: prepared.lines.map((line) => ({
        id: line.sku,
        name: line.name,
        quantity: line.quantity,
        priceGross: groszeToZl(line.unitPrice),
      })),
      totalGross: groszeToZl(prepared.total),
    },
    shippingMethods: seedShippingMethods(),
    paymentMethods: seedPaymentMethods(),
  };
}
