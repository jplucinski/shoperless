import { describe, expect, it } from "vitest";
import { inventoryReserveUpdate, keys } from "./keys.ts";

describe("keys", () => {
  it("scopes inventory to shop and sku", () => {
    expect(keys.inventory("shop_seed", "TOWEL-BLUE")).toEqual({
      pk: "SHOP#shop_seed",
      sk: "INVENTORY#TOWEL-BLUE",
    });
  });

  it("scopes reservations to order and sku", () => {
    expect(keys.reservation("shop_seed", "ord_1", "TOWEL-BLUE")).toEqual({
      pk: "SHOP#shop_seed",
      sk: "RESERVATION#ord_1#TOWEL-BLUE",
      gsi1pk: "SHOP#shop_seed#RESERVATION",
    });
  });

  it("scopes inventory events to sku", () => {
    expect(keys.inventoryEvent("shop_seed", "TOWEL-BLUE", "evt_1")).toEqual({
      pk: "SHOP#shop_seed",
      sk: "INVEVT#TOWEL-BLUE#evt_1",
    });
  });

  it("uses optimistic concurrency for reserve updates without create-on-miss", () => {
    const reserve = inventoryReserveUpdate(
      { shopId: "shop_seed", sku: "TOWEL-BLUE", onHand: 10, reserved: 2, version: 3 },
      4,
    );
    expect(reserve.condition).toContain("version = :expectedVersion");
    expect(reserve.condition).toContain("onHand >= :minOnHand");
    expect(reserve.condition).not.toContain("attribute_not_exists");
    expect(reserve.values[":minOnHand"]).toBe(6);
    expect(reserve.values[":expectedVersion"]).toBe(3);
  });
});
