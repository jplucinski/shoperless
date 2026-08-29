import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInboundOrder, parseInboundPayment } from "./inbound.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("parseInboundOrder", () => {
  it("reads sku and quantity only", () => {
    const body = JSON.parse(
      readFileSync(join(fixtures, "order-inbound.json"), "utf8"),
    ) as unknown;
    const cmd = parseInboundOrder(body, "shop_seed");
    expect(cmd).toEqual({
      shopId: "shop_seed",
      externalOrderId: "furgo_1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
    });
    expect(cmd.items[0]).not.toHaveProperty("unitPrice");
  });
});

describe("parseInboundPayment", () => {
  it("maps the fixture payment status", () => {
    const body = JSON.parse(
      readFileSync(join(fixtures, "payment-inbound.json"), "utf8"),
    ) as unknown;
    expect(parseInboundPayment(body, "shop_seed")).toEqual({
      shopId: "shop_seed",
      externalOrderId: "furgo_1",
      paymentStatus: "PAID",
    });
  });
});
