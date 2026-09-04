import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { OrderMirror } from "@liteshop/core";
import { parseAddOrder, parseAddPayment, parseTrackingNumber, toOrderOut } from "./inbound.ts";
import { parseFurgonetkaRoute } from "./shop-api.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("parseAddOrder", () => {
  it("reads sourceProductId as sku from the fixture", () => {
    const body = JSON.parse(
      readFileSync(join(fixtures, "add-order-in.json"), "utf8"),
    ) as unknown;
    const cmd = parseAddOrder(body, "shop_seed");
    expect(cmd.cartId).toBe("cart-seed-1");
    expect(cmd.items).toEqual([{ sku: "TOWEL-BLUE", quantity: 2 }]);
    expect(cmd.shippingAddress.email).toBe("test@example.com");
    expect(cmd.codAmount).toBe(0);
    expect(cmd.service).toBe("dpd");
  });
});

describe("parseAddPayment", () => {
  it("maps payment to orderId lookup", () => {
    const body = JSON.parse(
      readFileSync(join(fixtures, "add-payment-in.json"), "utf8"),
    ) as unknown;
    expect(parseAddPayment(body, "shop_seed", "order_1")).toEqual({
      shopId: "shop_seed",
      orderId: "order_1",
      paymentStatus: "PAID",
      paidAmount: 39800,
    });
  });
});

describe("parseTrackingNumber", () => {
  it("parses tracking payload", () => {
    const body = JSON.parse(
      readFileSync(join(fixtures, "tracking-number-in.json"), "utf8"),
    ) as unknown;
    expect(parseTrackingNumber(body, "shop_seed", "order_1")).toEqual({
      shopId: "shop_seed",
      orderId: "order_1",
      trackingNumber: "1234567890",
      courierService: "dpd",
    });
  });
});

describe("parseFurgonetkaRoute", () => {
  it("matches orders collection and nested paths", () => {
    expect(parseFurgonetkaRoute("orders")).toEqual({ kind: "orders-collection" });
    expect(parseFurgonetkaRoute("orders/256/payments")).toEqual({
      kind: "orders-payments",
      sourceOrderId: "256",
    });
    expect(parseFurgonetkaRoute("orders/256/tracking_number")).toEqual({
      kind: "orders-tracking",
      sourceOrderId: "256",
    });
    expect(parseFurgonetkaRoute("payments")).toBeUndefined();
  });
});

describe("toOrderOut", () => {
  it("includes required OrderOut fields", () => {
    const order: OrderMirror = {
      id: "order_1",
      shopId: "shop_seed",
      externalOrderId: "cart-seed-1",
      status: "CREATED",
      paymentStatus: "PAID",
      shippingStatus: "NOT_SHIPPED",
      items: [
        { sku: "TOWEL-BLUE", name: "Blue Towel", quantity: 2, unitPrice: 19900 },
      ],
      total: 39800,
      createdAt: new Date("2026-08-24T12:00:00.000Z"),
      shippingAddress: {
        street: "Polna 1/2",
        city: "Gdańsk",
        postcode: "80-300",
        countryCode: "PL",
        phone: "500123456",
        email: "test@example.com",
        name: "Jan",
        surname: "Kowalski",
      },
      codAmount: 0,
      totalPaid: 39800,
      courierService: "dpd",
      pickupPoint: "PL11033",
    };
    const out = toOrderOut(order);
    expect(out.sourceOrderId).toBe("order_1");
    expect(out.totalPrice).toBe(398);
    expect(out.totalPaid).toBe(398);
    expect(out.service).toBe("dpd");
    expect(out.point).toBe("PL11033");
    expect(out.products[0]).toMatchObject({
      sourceProductId: "TOWEL-BLUE",
      name: "Blue Towel",
      priceGross: 199,
      quantity: 2,
    });
  });
});
