import { describe, expect, it } from "vitest";
import { UlidGenerator } from "../ids.ts";
import { FixedClock } from "../clock.ts";
import { MemoryProductRepository } from "../product/memory-product-repository.ts";
import { ProductService } from "../product/product-service.ts";
import { MemoryInventoryRepository } from "../inventory/memory-inventory-repository.ts";
import { InventoryService } from "../inventory/inventory-service.ts";
import { CartService } from "./cart-service.ts";

const shopId = "shop_seed";

async function setup() {
  const products = new MemoryProductRepository();
  const inventory = new MemoryInventoryRepository();
  const productService = new ProductService({ products, ids: new UlidGenerator() });
  const stock = new InventoryService({
    inventory,
    clock: new FixedClock(new Date("2026-08-24T12:00:00.000Z")),
    ids: new UlidGenerator(),
  });
  await productService.create({
    shopId,
    sku: "TOWEL-BLUE",
    slug: "blue-towel",
    name: "Blue Towel",
    description: "",
    images: [],
    price: 19900,
  });
  await stock.applyDelivery(shopId, "TOWEL-BLUE", 2);
  return new CartService({ products, inventory });
}

describe("CartService.prepare", () => {
  it("snapshots server price and ignores client totals", async () => {
    const cart = await setup();
    const prepared = await cart.prepare(shopId, [
      { sku: "TOWEL-BLUE", quantity: 2 },
    ]);
    expect(prepared).toEqual({
      shopId,
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
    });
  });

  it("does not mutate inventory when stock is missing", async () => {
    const products = new MemoryProductRepository();
    const inventory = new MemoryInventoryRepository();
    const productService = new ProductService({ products, ids: new UlidGenerator() });
    await productService.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 19900,
    });
    const cart = new CartService({ products, inventory });
    await expect(
      cart.prepare(shopId, [{ sku: "TOWEL-BLUE", quantity: 1 }]),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await inventory.get(shopId, "TOWEL-BLUE")).toBeUndefined();
  });
});
