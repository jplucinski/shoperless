import { describe, expect, it } from "vitest";
import { handleFurgonetkaInbound } from "./inbound-http.ts";

const orders = {
  async listSince() {
    return [];
  },
  async createFromExternal() {
    throw new Error("not used");
  },
  async applyPayment() {
    throw new Error("not used");
  },
  async applyTracking() {
    throw new Error("not used");
  },
};

describe("handleFurgonetkaInbound", () => {
  it("returns 401 when the shared key is missing", async () => {
    const result = await handleFurgonetkaInbound({
      method: "GET",
      path: "orders",
      authHeader: null,
      expectedKey: "secret",
      shopId: "shop_seed",
      body: null,
      datetime: undefined,
      limit: null,
      orders,
    });
    expect(result.status).toBe(401);
  });

  it("returns 400 for an unknown payment status", async () => {
    const result = await handleFurgonetkaInbound({
      method: "POST",
      path: "orders/ord_1/payments",
      authHeader: "secret",
      expectedKey: "secret",
      shopId: "shop_seed",
      body: { paymentStatus: "chargeback", paidAmount: 10 },
      datetime: undefined,
      limit: null,
      orders,
    });
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "invalid_payment_status" });
  });
});
