import { describe, expect, it } from "vitest";
import type { PreparedCheckout } from "@liteshop/core";
import { SEED_PAYMENT_METHOD_ID, SEED_SHIPPING_METHOD_ID } from "./checkout-methods.ts";
import { toCheckoutCartData } from "./map-checkout.ts";

describe("toCheckoutCartData", () => {
  it("maps grosze onto CheckoutCartData with shipping and payment methods", () => {
    const prepared: PreparedCheckout = {
      shopId: "shop_seed",
      currency: "PLN",
      lines: [
        {
          sku: "TOWEL-BLUE",
          name: "Blue Towel",
          quantity: 2,
          unitPrice: 19900,
          lineTotal: 39800,
        },
      ],
      total: 39800,
    };
    const data = toCheckoutCartData(prepared);
    expect(data.cart).toEqual({
      id: null,
      currency: "PLN",
      products: [
        {
          id: "TOWEL-BLUE",
          name: "Blue Towel",
          quantity: 2,
          priceGross: 199,
        },
      ],
      totalGross: 398,
    });
    expect(data.paymentMethods).toHaveLength(1);
    expect(data.paymentMethods[0]?.id).toBe(SEED_PAYMENT_METHOD_ID);
    expect(data.shippingMethods).toHaveLength(1);
    expect(data.shippingMethods[0]?.id).toBe(SEED_SHIPPING_METHOD_ID);
  });
});
