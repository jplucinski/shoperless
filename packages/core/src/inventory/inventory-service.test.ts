import { describe, expect, it } from "vitest";
import { FixedClock } from "../clock.ts";
import { UlidGenerator } from "../ids.ts";
import { available } from "./inventory.ts";
import { MemoryInventoryRepository } from "./memory-inventory-repository.ts";
import { InventoryService } from "./inventory-service.ts";

const shopId = "shop_seed";
const sku = "TOWEL-BLUE";
const now = new Date("2026-08-24T12:00:00.000Z");

function service(ttl = 20 * 60 * 1000) {
  return new InventoryService({
    inventory: new MemoryInventoryRepository(),
    clock: new FixedClock(now),
    ids: new UlidGenerator(),
    reservationTtlMs: ttl,
  });
}

describe("InventoryService", () => {
  it("derives available from onHand minus reserved", async () => {
    const stock = service();
    const afterDelivery = await stock.applyDelivery(shopId, sku, 100);
    expect(afterDelivery.onHand).toBe(100);
    expect(afterDelivery.reserved).toBe(0);
    expect(available(afterDelivery)).toBe(100);
    await stock.reserve(shopId, sku, 4, "ord_1");
    const current = await stock.reserve(shopId, sku, 1, "ord_2");
    expect(available({ shopId, sku, onHand: 100, reserved: 5 })).toBe(95);
    expect(current.quantity).toBe(1);
  });

  it("refuses to oversell", async () => {
    const stock = service();
    await stock.applyDelivery(shopId, sku, 1);
    await stock.reserve(shopId, sku, 1, "ord_1");
    await expect(
      stock.reserve(shopId, sku, 1, "ord_2"),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("lets only one of two concurrent last-unit reserves succeed", async () => {
    const stock = service();
    await stock.applyDelivery(shopId, sku, 1);
    const results = await Promise.allSettled([
      stock.reserve(shopId, sku, 1, "ord_a"),
      stock.reserve(shopId, sku, 1, "ord_b"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("confirmSale decrements onHand once even when called twice", async () => {
    const repo = new MemoryInventoryRepository();
    const stock = new InventoryService({
      inventory: repo,
      clock: new FixedClock(now),
      ids: new UlidGenerator(),
    });
    await stock.applyDelivery(shopId, sku, 10);
    await stock.reserve(shopId, sku, 2, "ord_1");
    await stock.confirmSale(shopId, "ord_1");
    await stock.confirmSale(shopId, "ord_1");
    const inv = await repo.get(shopId, sku);
    expect(inv).toEqual({ shopId, sku, onHand: 8, reserved: 0 });
  });

  it("releaseExpired restores reserved without changing onHand", async () => {
    const repo = new MemoryInventoryRepository();
    const clock = new FixedClock(now);
    const stock = new InventoryService({
      inventory: repo,
      clock,
      ids: new UlidGenerator(),
      reservationTtlMs: 0,
    });
    await stock.applyDelivery(shopId, sku, 10);
    await stock.reserve(shopId, sku, 2, "ord_exp");
    const released = await stock.releaseExpired(shopId);
    expect(released).toBe(1);
    const inv = await repo.get(shopId, sku);
    expect(inv).toEqual({ shopId, sku, onHand: 10, reserved: 0 });
    expect(await stock.releaseExpired(shopId)).toBe(0);
  });

  it("listEvents returns delivery then adjustment in order", async () => {
    const stock = service();
    await stock.applyDelivery(shopId, sku, 10);
    await stock.applyAdjustment(shopId, sku, -2);
    const events = await stock.listEvents(shopId, sku);
    expect(events.map((event) => event.reason)).toEqual(["DELIVERY", "ADJUSTMENT"]);
    expect(events.map((event) => event.deltaOnHand)).toEqual([10, -2]);
  });
});
