import { describe, expect, it } from "vitest";
import { FixedClock } from "../clock.ts";
import { UlidGenerator } from "../ids.ts";
import { MemoryProductRepository } from "../product/memory-product-repository.ts";
import { ProductService } from "../product/product-service.ts";
import { MemoryInventoryRepository } from "../inventory/memory-inventory-repository.ts";
import { InventoryService } from "../inventory/inventory-service.ts";
import { CartService } from "../cart/cart-service.ts";
import { MemoryPrepareSnapshotRepository } from "../cart/memory-prepare-snapshot-repository.ts";
import { MemoryOrderRepository } from "./memory-order-repository.ts";
import { OrderService } from "./order-service.ts";
import type { ShippingAddress } from "./order.ts";

const shopId = "shop_seed";
const now = new Date("2026-08-24T12:00:00.000Z");

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

async function setup(stockAmount = 2, secondSku?: { sku: string; qty: number }) {
  const products = new MemoryProductRepository();
  const inventory = new MemoryInventoryRepository();
  const orders = new MemoryOrderRepository(inventory);
  const ids = new UlidGenerator();
  const clock = new FixedClock(now);
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
  await stock.applyDelivery(shopId, "TOWEL-BLUE", stockAmount);
  if (secondSku) {
    await productService.create({
      shopId,
      sku: secondSku.sku,
      slug: `${secondSku.sku}-slug`,
      name: secondSku.sku,
      description: "",
      images: [],
      price: 9900,
    });
    await stock.applyDelivery(shopId, secondSku.sku, secondSku.qty);
  }
  const cart = new CartService({ products, inventory });
  const orderService = new OrderService({ orders, cart, stock, ids, clock });
  return { orderService, inventory, stock, orders };
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

  it("is idempotent under concurrent duplicate ORDER_CREATED", async () => {
    const { orderService, inventory } = await setup(4);
    const cmd = {
      shopId,
      cartId: "cart-concurrent",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    };
    const results = await Promise.all([
      orderService.createFromExternal(cmd),
      orderService.createFromExternal(cmd),
    ]);
    const created = results.filter((r) => r.created);
    const duplicates = results.filter((r) => !r.created);
    expect(created).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
    expect(created[0]?.order.id).toBe(duplicates[0]?.order.id);
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 4, reserved: 2 });
  });

  it("reserves both skus in a two-line cart", async () => {
    const { orderService, inventory } = await setup(5, { sku: "TOWEL-RED", qty: 3 });
    await orderService.createFromExternal({
      shopId,
      cartId: "cart-two-sku",
      items: [
        { sku: "TOWEL-BLUE", quantity: 2 },
        { sku: "TOWEL-RED", quantity: 1 },
      ],
      shippingAddress,
    });
    expect(await inventory.get(shopId, "TOWEL-BLUE")).toMatchObject({
      onHand: 5,
      reserved: 2,
    });
    expect(await inventory.get(shopId, "TOWEL-RED")).toMatchObject({
      onHand: 3,
      reserved: 1,
    });
  });

  it("is idempotent under concurrent duplicate PAYMENT_PAID", async () => {
    const { orderService, inventory } = await setup(5);
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-paid-concurrent",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    await Promise.all([
      orderService.applyPayment({
        shopId,
        orderId: created.order.id,
        paymentStatus: "PAID",
        paidAmount: 39800,
      }),
      orderService.applyPayment({
        shopId,
        orderId: created.order.id,
        paymentStatus: "PAID",
        paidAmount: 39800,
      }),
    ]);
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 3, reserved: 0 });
  });

  it("uses prepare snapshot prices instead of repricing at inbound", async () => {
    const products = new MemoryProductRepository();
    const inventory = new MemoryInventoryRepository();
    const orders = new MemoryOrderRepository(inventory);
    const snapshots = new MemoryPrepareSnapshotRepository();
    const ids = new UlidGenerator();
    const clock = new FixedClock(now);
    const productService = new ProductService({ products, ids });
    const stock = new InventoryService({ inventory, clock, ids });
    const createdProduct = await productService.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 19900,
    });
    await stock.applyDelivery(shopId, "TOWEL-BLUE", 5);
    await snapshots.save({
      shopId,
      prepareId: "prep_1",
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
      currency: "PLN",
      expiresAt: new Date(now.getTime() + 60_000),
    });
    createdProduct.price = 99900;
    await products.save(createdProduct);
    const cart = new CartService({ products, inventory });
    const orderService = new OrderService({
      orders,
      cart,
      stock,
      ids,
      clock,
      snapshots,
    });
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "prep_1",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    expect(created.order.total).toBe(39800);
    expect(created.order.items[0]?.unitPrice).toBe(19900);
  });

  it("PAID decrements onHand once by orderId", async () => {
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

  it("PAID after reservation expiry still decrements onHand", async () => {
    const products = new MemoryProductRepository();
    const inventory = new MemoryInventoryRepository();
    const orders = new MemoryOrderRepository(inventory);
    const ids = new UlidGenerator();
    const clock = new FixedClock(now);
    const stock = new InventoryService({
      inventory,
      clock,
      ids,
      reservationTtlMs: 0,
    });
    const productService = new ProductService({ products, ids });
    await productService.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 19900,
    });
    await stock.applyDelivery(shopId, "TOWEL-BLUE", 5);
    const cart = new CartService({ products, inventory });
    const orderService = new OrderService({ orders, cart, stock, ids, clock });
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-expire-then-paid",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    await stock.release(shopId, created.order.id);
    await orderService.applyPayment({
      shopId,
      orderId: created.order.id,
      paymentStatus: "PAID",
      paidAmount: 39800,
    });
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 3, reserved: 0 });
  });

  it("releaseExpiredReservations skips release when order is PAID before cron runs", async () => {
    const products = new MemoryProductRepository();
    const inventory = new MemoryInventoryRepository();
    const orders = new MemoryOrderRepository(inventory);
    const ids = new UlidGenerator();
    const clock = new FixedClock(now);
    const stock = new InventoryService({
      inventory,
      clock,
      ids,
      reservationTtlMs: 0,
    });
    const productService = new ProductService({ products, ids });
    await productService.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 19900,
    });
    await stock.applyDelivery(shopId, "TOWEL-BLUE", 5);
    const cart = new CartService({ products, inventory });
    const orderService = new OrderService({ orders, cart, stock, ids, clock });
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-paid-before-cron",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    await orderService.applyPayment({
      shopId,
      orderId: created.order.id,
      paymentStatus: "PAID",
      paidAmount: 39800,
    });
    const released = await orderService.releaseExpiredReservations(shopId);
    expect(released).toBe(0);
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 3, reserved: 0 });
  });

  it("releaseExpiredReservations skips PAID orders", async () => {
    const products = new MemoryProductRepository();
    const inventory = new MemoryInventoryRepository();
    const orders = new MemoryOrderRepository(inventory);
    const ids = new UlidGenerator();
    const clock = new FixedClock(now);
    const stock = new InventoryService({
      inventory,
      clock,
      ids,
      reservationTtlMs: 0,
    });
    const productService = new ProductService({ products, ids });
    await productService.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 19900,
    });
    await stock.applyDelivery(shopId, "TOWEL-BLUE", 5);
    const cart = new CartService({ products, inventory });
    const orderService = new OrderService({ orders, cart, stock, ids, clock });
    const created = await orderService.createFromExternal({
      shopId,
      cartId: "cart-paid-skip",
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
      shippingAddress,
    });
    created.order.paymentStatus = "PAID";
    await orders.save(created.order);
    const released = await orderService.releaseExpiredReservations(shopId);
    expect(released).toBe(0);
    const inv = await inventory.get(shopId, "TOWEL-BLUE");
    expect(inv).toMatchObject({ onHand: 5, reserved: 2 });
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
