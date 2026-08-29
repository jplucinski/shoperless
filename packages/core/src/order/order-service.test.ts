import { describe, expect, it } from "vitest";
import { FixedClock } from "../clock.ts";
import { UlidGenerator } from "../ids.ts";
import { MemoryProductRepository } from "../product/memory-product-repository.ts";
import { ProductService } from "../product/product-service.ts";
import { MemoryInventoryRepository } from "../inventory/memory-inventory-repository.ts";
import { InventoryService } from "../inventory/inventory-service.ts";
import { CartService } from "../cart/cart-service.ts";
import { MemoryOrderRepository } from "./memory-order-repository.ts";
import { OrderService } from "./order-service.ts";

const shopId = "shop_seed";

async function setup() {
  const products = new MemoryProductRepository();
  const inventory = new MemoryInventoryRepository();
  const orders = new MemoryOrderRepository();
  const ids = new UlidGenerator();
  const clock = new FixedClock(new Date("2026-08-24T12:00:00.000Z"));
  const productService = new ProductService({ products, ids });
  const stock = new InventoryService({ inventory, clock, ids });
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
  const cart = new CartService({ products, inventory });
  const orderService = new OrderService({ orders, cart, stock, ids });
  return { orderService, inventory };
}

describe("OrderService", () => {
  it("creates an order, reserves stock, and is idempotent on externalOrderId", async () => {
    const { orderService, inventory } = await setup();
    const cmd = {
      shopId,
      externalOrderId: "furgo_1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
    };
    const first = await orderService.createFromExternal(cmd);
    const second = await orderService.createFromExternal(cmd);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    expect(first.order.paymentStatus).toBe("PENDING");
    expect(first.order.total).toBe(39800);
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 2, reserved: 2 });
  });

  it("PAID decrements onHand once", async () => {
    const { orderService, inventory } = await setup();
    await orderService.createFromExternal({
      shopId,
      externalOrderId: "furgo_1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
    });
    await orderService.applyPayment({
      shopId,
      externalOrderId: "furgo_1",
      paymentStatus: "PAID",
    });
    await orderService.applyPayment({
      shopId,
      externalOrderId: "furgo_1",
      paymentStatus: "PAID",
    });
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 0, reserved: 0 });
  });

  it("FAILED releases reservation", async () => {
    const { orderService, inventory } = await setup();
    await orderService.createFromExternal({
      shopId,
      externalOrderId: "furgo_1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
    });
    await orderService.applyPayment({
      shopId,
      externalOrderId: "furgo_1",
      paymentStatus: "FAILED",
    });
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 2, reserved: 0 });
  });
});
