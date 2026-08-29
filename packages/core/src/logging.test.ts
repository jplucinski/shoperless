import { describe, expect, it } from "vitest";
import { createJsonLogger } from "./logging.ts";

describe("createJsonLogger", () => {
  it("writes shopId, operation, correlationId", () => {
    const lines: string[] = [];
    const logger = createJsonLogger((line) => lines.push(line));
    logger.info({
      shopId: "shop_seed",
      operation: "order.create",
      orderId: "ord_1",
      externalOrderId: "furgo_1",
      sku: "TOWEL-BLUE",
      correlationId: "corr_1",
    });
    expect(JSON.parse(lines[0]!)).toMatchObject({
      shopId: "shop_seed",
      operation: "order.create",
      correlationId: "corr_1",
    });
    expect(lines[0]).not.toMatch(/token/i);
  });
});
