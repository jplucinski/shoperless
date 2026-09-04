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
import type { ShippingAddress } from "./order.ts";

const shopId = "shop_seed";

const shippingAddress: ShippingAddress = {
  street: "Polna 1/2",
  city: "Gdańsk",
  postcode: "80-300",
  countryCode: "PL",
  phone: "500123456",
  email: "test@example.com",
  name: "Jan",
  surname: "Kowalski",
};

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
  it("creates an order, reserves stock, and is idempotent on cartId", async () => {
    const { orderService, inventory } = await setup();
    const cmd = {
      shopId,
      cartId: "cart-seed-1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
      datetimeOrder: "2026-08-24T12:00:00.000Z",
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

  it("PAID decrements onHand once by sourceOrderId", async () => {
    const { orderService, inventory } = await setup();
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-seed-1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    const paid = await orderService.applyPayment({
      shopId,
      orderId: created.order.id,
      paymentStatus: "PAID",
      paidAmount: 39800,
    });
    await orderService.applyPayment({
      shopId,
      orderId: created.order.id,
      paymentStatus: "PAID",
      paidAmount: 39800,
    });
    expect(paid.totalPaid).toBe(39800);
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 0, reserved: 0 });
  });

  it("FAILED releases reservation", async () => {
    const { orderService, inventory } = await setup();
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-seed-1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    await orderService.applyPayment({
      shopId,
      orderId: created.order.id,
      paymentStatus: "FAILED",
    });
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 2, reserved: 0 });
  });

  it("listSince returns orders newer than datetime oldest-first", async () => {
    const { orderService } = await setup();
    await orderService.createFromExternal({
      shopId,
      cartId: "cart-a",
      items: [{ sku: "TOWEL-BLUE", quantity: 1 }],
      shippingAddress,
      datetimeOrder: "2026-08-24T10:00:00.000Z",
    });
    await orderService.createFromExternal({
      shopId,
      cartId: "cart-b",
      items: [{ sku: "TOWEL-BLUE", quantity: 1 }],
      shippingAddress,
      datetimeOrder: "2026-08-24T12:00:00.000Z",
    });
    const listed = await orderService.listSince(
      shopId,
      "2026-08-24T11:00:00.000Z",
      100,
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]?.externalOrderId).toBe("cart-b");
  });

  it("applyTracking marks order in transit", async () => {
    const { orderService } = await setup();
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-seed-1",
      items: [{ sku: "TOWEL-BLUE", quantity: 1 }],
      shippingAddress,
    });
    const updated = await orderService.applyTracking({
      shopId,
      orderId: created.order.id,
      trackingNumber: "123",
      courierService: "dpd",
    });
    expect(updated.shippingStatus).toBe("IN_TRANSIT");
    expect(updated.trackingNumber).toBe("123");
  });
});
