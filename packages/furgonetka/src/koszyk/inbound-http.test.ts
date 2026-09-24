import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DomainError, InsufficientStockError } from "@liteshop/core";
import { handleFurgonetkaInbound } from "./inbound-http.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

const base = {
  expectedKey: "secret",
  shopId: "shop_seed",
  datetime: undefined,
  limit: null,
};

describe("handleFurgonetkaInbound", () => {
  it("returns 401 when the shared key is missing", async () => {
    const result = await handleFurgonetkaInbound({
      method: "GET",
      path: "orders",
      authHeader: null,
      body: null,
      orders: {
        listSince: async () => [],
        createFromExternal: async () => {
          throw new Error("not used");
        },
        applyPayment: async () => {
          throw new Error("not used");
        },
        applyTracking: async () => {
          throw new Error("not used");
        },
      },
      ...base,
    });
    expect(result.status).toBe(401);
  });

  it("returns 400 for an unknown payment status", async () => {
    const result = await handleFurgonetkaInbound({
      method: "POST",
      path: "orders/ord_1/payments",
      authHeader: "secret",
      body: { paymentStatus: "chargeback", paidAmount: 10 },
      orders: {
        listSince: async () => [],
        createFromExternal: async () => {
          throw new Error("not used");
        },
        applyPayment: async () => {
          throw new Error("not used");
        },
        applyTracking: async () => {
          throw new Error("not used");
        },
      },
      ...base,
    });
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "invalid_payment_status" });
  });

  it("returns 409 when ORDER_CREATED oversells", async () => {
    const result = await handleFurgonetkaInbound({
      method: "POST",
      path: "orders",
      authHeader: "secret",
      body: JSON.parse(readFileSync(join(fixtures, "add-order-in.json"), "utf8")),
      orders: {
        listSince: async () => [],
        createFromExternal: async () => {
          throw new InsufficientStockError("TOWEL-BLUE", 99);
        },
        applyPayment: async () => {
          throw new Error("not used");
        },
        applyTracking: async () => {
          throw new Error("not used");
        },
      },
      ...base,
    });
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: "insufficient_stock" });
  });

  it("returns 503 when payment arrives before the order exists", async () => {
    const result = await handleFurgonetkaInbound({
      method: "POST",
      path: "orders/ord_1/payments",
      authHeader: "secret",
      body: { paymentStatus: "paid", paidAmount: 10 },
      orders: {
        listSince: async () => [],
        createFromExternal: async () => {
          throw new Error("not used");
        },
        applyPayment: async () => {
          throw new DomainError("ORDER_NOT_FOUND", "missing");
        },
        applyTracking: async () => {
          throw new Error("not used");
        },
      },
      ...base,
    });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: "order_not_ready" });
  });
});
