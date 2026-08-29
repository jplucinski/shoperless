import { describe, expect, it } from "vitest";
import { keys, RESERVE_CONDITION } from "./keys.ts";

describe("keys", () => {
  it("scopes inventory to shop and sku", () => {
    expect(keys.inventory("shop_seed", "TOWEL-BLUE")).toEqual({
      pk: "SHOP#shop_seed",
      sk: "INVENTORY#TOWEL-BLUE",
    });
  });

  it("exports the reserve ConditionExpression", () => {
    expect(RESERVE_CONDITION).toContain("onHand - reserved >= :qty");
  });
});
