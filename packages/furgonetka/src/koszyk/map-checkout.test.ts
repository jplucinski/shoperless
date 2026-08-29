import { describe, expect, it } from "vitest";
import type { PreparedCheckout } from "@liteshop/core";
import { toCheckoutCartData } from "./map-checkout.ts";

describe("toCheckoutCartData", () => {
  it("maps grosze onto złoty money fields", () => {
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
    expect(toCheckoutCartData(prepared)).toEqual({
      products: [
        {
          name: "Blue Towel",
          sku: "TOWEL-BLUE",
          quantity: 2,
          price: 199,
        },
      ],
      totalPrice: 398,
    });
  });
});
