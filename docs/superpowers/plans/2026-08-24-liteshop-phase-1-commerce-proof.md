# LiteShop Phase 1 — Commerce Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Parent: [2026-08-24-liteshop-mvp.md](./2026-08-24-liteshop-mvp.md). Depends on: [2026-08-24-liteshop-phase-0-bootstrap.md](./2026-08-24-liteshop-phase-0-bootstrap.md). Spec: [docs/prd.md](../../prd.md) §16–37, §43–47, §49 (commerce subset).
>
> Do not start Phase 2 until the Phase 1 gate (sandbox paid order) passes.

**Goal:** A customer can buy a seeded product end-to-end through Furgonetka Koszyk; LiteShop reserves stock, marks the Order Mirror PAID once, and the merchant sees it in admin.

**Architecture:** `@liteshop/core` owns Product, Inventory, Reservation, Order Mirror, and cart validation behind in-memory ports. `@liteshop/furgonetka` is the only package that knows Koszyk payloads, shared-key auth, and OAuth. `apps/web` is a hardcoded Astro storefront plus a small admin. No Store Definition, no LLM.

**Tech Stack:** Same as Phase 0, plus DynamoDB Document client in adapters only, `aws4` not required (shared key header), cookie sessions via `astro` API routes.

## Global Constraints

Inherited from Phase 0, plus:

- Hardcoded storefront only. Do not create `@liteshop/schema` or `@liteshop/renderer`.
- `available` is never written to DynamoDB.
- Client may send only `{ sku, quantity }`. Server snapshots `unitPrice` from Product at order creation.
- Duplicate `externalOrderId` returns the existing Order Mirror and does not reserve again.
- Duplicate PAID callback is a no-op: `onHand` decreases once.
- Provider payment status names stay inside `@liteshop/furgonetka`.
- Admin until Task 12 uses env password cookie `ls_admin`. Task 12 replaces login with Furgonetka OAuth but keeps the same `ls_session` cookie shape.
- Inbound Koszyk URL paths are copied from https://furgonetka.pl/api/koszyk — not invented in this plan. Internal commands below are the stable core API the adapter maps onto.

---

## File map

```text
packages/core/src/product/product.ts
packages/core/src/product/product-repository.ts
packages/core/src/product/memory-product-repository.ts
packages/core/src/product/product-service.ts
packages/core/src/product/product-service.test.ts
packages/core/src/inventory/inventory.ts
packages/core/src/inventory/inventory-repository.ts
packages/core/src/inventory/memory-inventory-repository.ts
packages/core/src/inventory/inventory-service.ts
packages/core/src/inventory/inventory-service.test.ts
packages/core/src/order/order.ts
packages/core/src/order/order-repository.ts
packages/core/src/order/memory-order-repository.ts
packages/core/src/order/order-service.ts
packages/core/src/order/order-service.test.ts
packages/core/src/cart/cart.ts
packages/core/src/cart/cart-service.ts
packages/core/src/cart/cart-service.test.ts
packages/core/src/logging.ts
packages/core/src/index.ts
packages/furgonetka/src/koszyk/checkout-cart-data.ts
packages/furgonetka/src/koszyk/map-checkout.ts
packages/furgonetka/src/koszyk/map-checkout.test.ts
packages/furgonetka/src/koszyk/shared-key.ts
packages/furgonetka/src/koszyk/shared-key.test.ts
packages/furgonetka/src/koszyk/inbound.ts
packages/furgonetka/src/koszyk/inbound.test.ts
packages/furgonetka/src/koszyk/payment-status.ts
packages/furgonetka/src/koszyk/payment-status.test.ts
packages/furgonetka/src/oauth/oauth.ts
packages/furgonetka/src/fixtures/
apps/web/src/lib/core.ts
apps/web/src/lib/session.ts
apps/web/src/pages/api/checkout/prepare.ts
apps/web/src/pages/api/furgonetka/[...path].ts
apps/web/src/pages/api/admin/login.ts
apps/web/src/pages/index.astro
apps/web/src/pages/products/[slug].astro
apps/web/src/pages/cart.astro
apps/web/src/pages/admin/index.astro
apps/web/src/pages/admin/orders/index.astro
apps/web/src/pages/admin/orders/[id].astro
apps/web/src/pages/admin/products/index.astro
apps/web/src/pages/admin/inventory/index.astro
apps/web/src/islands/CartButton.tsx
apps/web/src/islands/CheckoutButton.tsx
apps/web/src/jobs/release-expired-reservations.ts
```

---

### Task 1: Product model and in-memory repository

**Files:**
- Create: `packages/core/src/product/product.ts`
- Create: `packages/core/src/product/product-repository.ts`
- Create: `packages/core/src/product/memory-product-repository.ts`
- Create: `packages/core/src/product/product-service.ts`
- Modify: `packages/core/src/errors.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/product/product-service.test.ts`

**Interfaces:**
- Consumes: `ShopId`, `ProductId`, `Sku`, `Money`, `assertMoney`, `IdGenerator`, `SEED_SHOP_ID`, `DomainError` from Phase 0
- Produces:

```ts
export type ProductStatus = "active" | "inactive";

export interface Product {
  id: ProductId;
  shopId: ShopId;
  sku: Sku;
  slug: string;
  name: string;
  description: string;
  images: string[];
  price: Money;
  status: ProductStatus;
  metadata: Record<string, string>;
}

export interface ProductRepository {
  getById(shopId: ShopId, productId: ProductId): Promise<Product | undefined>;
  getBySku(shopId: ShopId, sku: Sku): Promise<Product | undefined>;
  getBySlug(shopId: ShopId, slug: string): Promise<Product | undefined>;
  list(shopId: ShopId): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

export class ProductService {
  constructor(deps: { products: ProductRepository; ids: IdGenerator });
  create(input: {
    shopId: ShopId;
    sku: Sku;
    slug: string;
    name: string;
    description: string;
    images: string[];
    price: Money;
    status?: ProductStatus;
  }): Promise<Product>;
  listActive(shopId: ShopId): Promise<Product[]>;
  getActiveBySlug(shopId: ShopId, slug: string): Promise<Product>;
}

export class DuplicateSkuError extends DomainError // code: "DUPLICATE_SKU"
export class DuplicateSlugError extends DomainError // code: "DUPLICATE_SLUG"
export class ProductNotFoundError extends DomainError // code: "PRODUCT_NOT_FOUND"
export class ProductInactiveError extends DomainError // code: "PRODUCT_INACTIVE"
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { UlidGenerator } from "../ids.ts";
import { MemoryProductRepository } from "./memory-product-repository.ts";
import { ProductService } from "./product-service.ts";

const shopId = "shop_seed";

function service() {
  return new ProductService({
    products: new MemoryProductRepository(),
    ids: new UlidGenerator(),
  });
}

describe("ProductService", () => {
  it("creates a product and lists it when active", async () => {
    const products = service();
    const created = await products.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "Soft",
      images: ["https://img.example/t.jpg"],
      price: 19900,
    });
    expect(created.price).toBe(19900);
    expect(created.status).toBe("active");
    const listed = await products.listActive(shopId);
    expect(listed.map((p) => p.sku)).toEqual(["TOWEL-BLUE"]);
  });

  it("rejects duplicate sku in the same shop", async () => {
    const products = service();
    const input = {
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 100,
    };
    await products.create(input);
    await expect(
      products.create({ ...input, slug: "other" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_SKU" });
  });

  it("does not list inactive products on the storefront", async () => {
    const products = service();
    await products.create({
      shopId,
      sku: "HIDDEN",
      slug: "hidden",
      name: "Hidden",
      description: "",
      images: [],
      price: 100,
      status: "inactive",
    });
    await expect(products.listActive(shopId)).resolves.toEqual([]);
    await expect(products.getActiveBySlug(shopId, "hidden")).rejects.toMatchObject({
      code: "PRODUCT_INACTIVE",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/core test src/product/product-service.test.ts`

Expected: FAIL with `Cannot find module './product-service.ts'`.

- [ ] **Step 3: Write minimal implementation**

`product.ts` — the `Product` / `ProductStatus` types above.

`product-repository.ts` — the `ProductRepository` interface above.

`memory-product-repository.ts`:

```ts
import type { ProductId, ShopId, Sku } from "../ids.ts";
import type { Product } from "./product.ts";
import type { ProductRepository } from "./product-repository.ts";

function key(shopId: ShopId, id: string): string {
  return `${shopId}#${id}`;
}

export class MemoryProductRepository implements ProductRepository {
  private readonly byId = new Map<string, Product>();

  async getById(shopId: ShopId, productId: ProductId) {
    return this.byId.get(key(shopId, productId));
  }
  async getBySku(shopId: ShopId, sku: Sku) {
    return [...this.byId.values()].find(
      (p) => p.shopId === shopId && p.sku === sku,
    );
  }
  async getBySlug(shopId: ShopId, slug: string) {
    return [...this.byId.values()].find(
      (p) => p.shopId === shopId && p.slug === slug,
    );
  }
  async list(shopId: ShopId) {
    return [...this.byId.values()].filter((p) => p.shopId === shopId);
  }
  async save(product: Product) {
    this.byId.set(key(product.shopId, product.id), product);
  }
}
```

`product-service.ts`: `create` calls `assertMoney`, rejects if `getBySku` or `getBySlug` hits, then `ids.productId()` + `save`. `listActive` filters `status === "active"`. `getActiveBySlug` throws `ProductNotFoundError` if missing, `ProductInactiveError` if inactive.

Add the four `DomainError` subclasses in `errors.ts` with the codes listed in Interfaces.

Re-export from `index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @liteshop/core test src/product/product-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: add product catalog with unique sku/slug and active listing

EOF
)"
```

---

### Task 2: Inventory reserve, sale, release

**Files:**
- Create: `packages/core/src/inventory/inventory.ts`
- Create: `packages/core/src/inventory/inventory-repository.ts`
- Create: `packages/core/src/inventory/memory-inventory-repository.ts`
- Create: `packages/core/src/inventory/inventory-service.ts`
- Modify: `packages/core/src/errors.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/inventory/inventory-service.test.ts`

**Interfaces:**
- Consumes: `ShopId`, `Sku`, `OrderId`, `Clock`, `FixedClock`, `IdGenerator`, `DomainError`
- Produces:

```ts
export interface Inventory {
  shopId: ShopId;
  sku: Sku;
  onHand: number;
  reserved: number;
}

export function available(inventory: Inventory): number {
  return inventory.onHand - inventory.reserved;
}

export type InventoryEventReason =
  | "DELIVERY"
  | "ADJUSTMENT"
  | "RESERVATION"
  | "SALE"
  | "RESERVATION_RELEASED";

export interface InventoryEvent {
  id: string;
  shopId: ShopId;
  sku: Sku;
  deltaOnHand: number;
  deltaReserved: number;
  reason: InventoryEventReason;
  orderId?: OrderId;
  createdAt: Date;
}

export type ReservationStatus = "open" | "sold" | "released";

export interface Reservation {
  shopId: ShopId;
  orderId: OrderId;
  sku: Sku;
  quantity: number;
  expiresAt: Date;
  status: ReservationStatus;
}

export interface InventoryRepository {
  get(shopId: ShopId, sku: Sku): Promise<Inventory | undefined>;
  save(inventory: Inventory): Promise<void>;
  appendEvent(event: InventoryEvent): Promise<void>;
  listEvents(shopId: ShopId, sku: Sku): Promise<InventoryEvent[]>;
  getReservation(shopId: ShopId, orderId: OrderId): Promise<Reservation | undefined>;
  saveReservation(reservation: Reservation): Promise<void>;
  listOpenExpired(shopId: ShopId, now: Date): Promise<Reservation[]>;
}

export const DEFAULT_RESERVATION_TTL_MS = 20 * 60 * 1000;

export class InventoryService {
  constructor(deps: {
    inventory: InventoryRepository;
    clock: Clock;
    ids: IdGenerator;
    reservationTtlMs?: number;
  });
  applyDelivery(shopId: ShopId, sku: Sku, quantity: number): Promise<Inventory>;
  applyAdjustment(shopId: ShopId, sku: Sku, deltaOnHand: number): Promise<Inventory>;
  reserve(
    shopId: ShopId,
    sku: Sku,
    quantity: number,
    orderId: OrderId,
  ): Promise<Reservation>;
  confirmSale(shopId: ShopId, orderId: OrderId): Promise<void>;
  release(shopId: ShopId, orderId: OrderId): Promise<void>;
  releaseExpired(shopId: ShopId): Promise<number>;
}

export class InsufficientStockError extends DomainError // code: "INSUFFICIENT_STOCK"
```

Rules the tests lock:

- `available` is computed, never stored.
- `reserve` succeeds only when `onHand - reserved >= quantity`; it increments `reserved` (not `onHand`) and writes `RESERVATION`.
- Concurrent reserves on the last unit: in-memory repo must serialize `reserve` per `shopId+sku` (async mutex). One succeeds, one throws `INSUFFICIENT_STOCK`.
- `confirmSale` decrements both `onHand` and `reserved` by the reservation quantity, writes `SALE`, marks reservation `sold`. Second call with the same `orderId` is a no-op.
- `release` / expiry decrements `reserved` only, writes `RESERVATION_RELEASED`. `onHand` unchanged. Second release is a no-op.

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/core test src/inventory/inventory-service.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Write minimal implementation**

`MemoryInventoryRepository.reserve` serialization: keep `private chains = new Map<string, Promise<void>>()` and wrap `InventoryService.reserve` so each `shopId#sku` runs FIFO. Implementation sketch:

```ts
async reserve(...) {
  const mutexKey = `${shopId}#${sku}`;
  const run = async () => {
    const inv = await this.repo.get(shopId, sku);
    const current = inv ?? { shopId, sku, onHand: 0, reserved: 0 };
    if (current.onHand - current.reserved < quantity) {
      throw new InsufficientStockError(sku, quantity);
    }
    const existing = await this.repo.getReservation(shopId, orderId);
    if (existing) return existing;
    current.reserved += quantity;
    await this.repo.save(current);
    const reservation = {
      shopId,
      orderId,
      sku,
      quantity,
      status: "open" as const,
      expiresAt: new Date(this.clock.now().getTime() + this.reservationTtlMs),
    };
    await this.repo.saveReservation(reservation);
    await this.repo.appendEvent({
      id: this.ids.eventId(),
      shopId,
      sku,
      deltaOnHand: 0,
      deltaReserved: quantity,
      reason: "RESERVATION",
      orderId,
      createdAt: this.clock.now(),
    });
    return reservation;
  };
  const previous = this.locks.get(mutexKey) ?? Promise.resolve();
  let release: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  this.locks.set(mutexKey, previous.then(() => current));
  await previous;
  try {
    return await run();
  } finally {
    release!();
  }
}
```

`confirmSale`: if reservation missing → throw `DomainError("RESERVATION_NOT_FOUND")`. If `status !== "open"` return. Else `onHand -= qty`, `reserved -= qty`, `status = "sold"`, event `SALE` with `deltaOnHand: -qty`, `deltaReserved: -qty`.

`release` / `releaseExpired`: if not `open`, skip. Else `reserved -= qty`, `status = "released"`, event `RESERVATION_RELEASED`.

`applyDelivery`: `onHand += quantity` (must be > 0), event `DELIVERY`.

`applyAdjustment`: `onHand += deltaOnHand` but reject if result would be `< reserved`. Event `ADJUSTMENT`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @liteshop/core test src/inventory/inventory-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: add inventory reservations with oversell protection and idempotent sale

EOF
)"
```

---

### Task 3: Cart prepare (no inventory mutation)

**Files:**
- Create: `packages/core/src/cart/cart.ts`
- Create: `packages/core/src/cart/cart-service.ts`
- Test: `packages/core/src/cart/cart-service.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `ProductService.getBySku` via `ProductRepository.getBySku`, `InventoryRepository.get`, `available()`, `ProductInactiveError`, `ProductNotFoundError`, `InsufficientStockError`
- Produces:

```ts
export interface CartItem {
  sku: Sku;
  quantity: number;
}

export interface PreparedLine {
  sku: Sku;
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface PreparedCheckout {
  shopId: ShopId;
  currency: "PLN";
  lines: PreparedLine[];
  total: Money;
}

export class CartService {
  constructor(deps: {
    products: ProductRepository;
    inventory: InventoryRepository;
  });
  prepare(shopId: ShopId, items: CartItem[]): Promise<PreparedCheckout>;
}
```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/core test src/cart/cart-service.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Write minimal implementation**

`prepare`: reject non-positive quantities with `DomainError("INVALID_CART", ...)`. For each item, `getBySku` → not found `PRODUCT_NOT_FOUND`, inactive `PRODUCT_INACTIVE`. `available(inv ?? zeros) < quantity` → `INSUFFICIENT_STOCK`. Sum `lineTotal = unitPrice * quantity`. Do not call `reserve`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @liteshop/core test src/cart/cart-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: validate cart server-side without reserving stock

EOF
)"
```

---

### Task 4: Order Mirror create + payment

**Files:**
- Create: `packages/core/src/order/order.ts`
- Create: `packages/core/src/order/order-repository.ts`
- Create: `packages/core/src/order/memory-order-repository.ts`
- Create: `packages/core/src/order/order-service.ts`
- Test: `packages/core/src/order/order-service.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `CartService.prepare`, `InventoryService.reserve`, `InventoryService.confirmSale`, `InventoryService.release`, `IdGenerator.orderId`, `Clock`
- Produces:

```ts
export type OrderStatus = "CREATED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type ShippingStatus = "NOT_SHIPPED" | "IN_TRANSIT" | "DELIVERED";

export interface OrderItem {
  sku: Sku;
  quantity: number;
  unitPrice: Money;
}

export interface OrderMirror {
  id: OrderId;
  shopId: ShopId;
  externalOrderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  items: OrderItem[];
  total: Money;
}

export interface CreateOrderCommand {
  shopId: ShopId;
  externalOrderId: string;
  items: CartItem[];
}

export interface ApplyPaymentCommand {
  shopId: ShopId;
  externalOrderId: string;
  paymentStatus: PaymentStatus;
}

export interface OrderRepository {
  getById(shopId: ShopId, orderId: OrderId): Promise<OrderMirror | undefined>;
  getByExternalId(shopId: ShopId, externalOrderId: string): Promise<OrderMirror | undefined>;
  save(order: OrderMirror): Promise<void>;
  list(shopId: ShopId): Promise<OrderMirror[]>;
}

export class OrderService {
  constructor(deps: {
    orders: OrderRepository;
    cart: CartService;
    stock: InventoryService;
    ids: IdGenerator;
  });
  createFromExternal(cmd: CreateOrderCommand): Promise<{ order: OrderMirror; created: boolean }>;
  applyPayment(cmd: ApplyPaymentCommand): Promise<OrderMirror>;
  list(shopId: ShopId): Promise<OrderMirror[]>;
  get(shopId: ShopId, orderId: OrderId): Promise<OrderMirror>;
}
```

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/core test src/order/order-service.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Write minimal implementation**

`createFromExternal`:

1. `getByExternalId` → if found, return `{ order, created: false }`.
2. `prepared = await cart.prepare(shopId, items)`.
3. `id = ids.orderId()`.
4. For each prepared line, `stock.reserve(shopId, line.sku, line.quantity, id)`. If a later line fails, `release` the new order id (best-effort; single-sku MVP can reserve after prepare because prepare already checked availability — still reserve in a loop).
5. Save Order Mirror `CREATED` / `PENDING` / `NOT_SHIPPED`, `items` from prepared lines, `total` from prepared.

`applyPayment`:

1. Load by external id or throw `DomainError("ORDER_NOT_FOUND")`.
2. If `paymentStatus` already equals command, return order.
3. If current is `PAID`, ignore later FAILED/CANCELLED (paid is terminal for inventory).
4. `PAID` → `stock.confirmSale` then set `paymentStatus: "PAID"`.
5. `FAILED` or `CANCELLED` → `stock.release`, set that payment status, `status: "CANCELLED"` if CANCELLED.

Phase 1 is single-sku lines in tests; implementation must still loop items for the 10-product catalog later.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @liteshop/core test src/order/order-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: add idempotent order mirror creation and payment transitions

EOF
)"
```

---

### Task 5: Structured commerce logger

**Files:**
- Create: `packages/core/src/logging.ts`
- Test: `packages/core/src/logging.test.ts`
- Modify: `packages/core/src/order/order-service.ts` to log create/pay
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `shopId`, `orderId`, `externalOrderId`, `sku`
- Produces:

```ts
export interface CommerceLog {
  shopId: ShopId;
  operation:
    | "order.create"
    | "order.create.duplicate"
    | "payment.apply"
    | "reservation.release"
    | "checkout.prepare"
    | "furgonetka.inbound";
  orderId?: OrderId;
  externalOrderId?: string;
  sku?: Sku;
  correlationId: string;
}

export interface Logger {
  info(event: CommerceLog): void;
  error(event: CommerceLog, error: unknown): void;
}

export function createJsonLogger(write?: (line: string) => void): Logger;
```

`createJsonLogger` JSON.stringifies the event. It must never put keys `access_token`, `refresh_token`, `authorization`, `password`, `sharedKey` into the payload (drop them if a caller spreads a request object by mistake — logger only accepts `CommerceLog`, which has none of those fields).

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/core test src/logging.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Write `createJsonLogger` as `console.log` JSON by default**

Wire `OrderService` to accept optional `logger?: Logger` and log `order.create` / `order.create.duplicate` / `payment.apply`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @liteshop/core test`

Expected: PASS including existing order tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: add structured commerce logs without secrets

EOF
)"
```

---

### Task 6: Furgonetka contract capture + payment mapping

**Files:**
- Create: `packages/furgonetka/src/koszyk/checkout-cart-data.ts`
- Create: `packages/furgonetka/src/koszyk/map-checkout.ts`
- Create: `packages/furgonetka/src/koszyk/shared-key.ts`
- Create: `packages/furgonetka/src/koszyk/payment-status.ts`
- Create: `packages/furgonetka/src/koszyk/inbound.ts`
- Create: `packages/furgonetka/package.json` scripts `test`
- Create: `packages/furgonetka/vitest.config.ts`
- Test: `packages/furgonetka/src/koszyk/map-checkout.test.ts`
- Test: `packages/furgonetka/src/koszyk/shared-key.test.ts`
- Test: `packages/furgonetka/src/koszyk/payment-status.test.ts`
- Test: `packages/furgonetka/src/koszyk/inbound.test.ts`
- Create: `packages/furgonetka/src/fixtures/README.md`

**Interfaces:**
- Consumes: `PreparedCheckout`, `CreateOrderCommand`, `ApplyPaymentCommand`, `PaymentStatus` from `@liteshop/core`
- Produces:

```ts
export function verifySharedKey(headerValue: string | null, expected: string): boolean;

export function toCheckoutCartData(prepared: PreparedCheckout): CheckoutCartData;

export function mapProviderPaymentStatus(providerStatus: string): PaymentStatus;

export function parseInboundOrder(
  body: unknown,
  shopId: ShopId,
): CreateOrderCommand;

export function parseInboundPayment(
  body: unknown,
  shopId: ShopId,
): ApplyPaymentCommand;

export function furgonetkaOrderUrl(externalOrderId: string): string;
```

Contract capture procedure (do this before writing Zod schemas — the captured file is the source of truth):

1. Open https://furgonetka.pl/api/koszyk.
2. Copy `CheckoutCartData` and `CheckoutInitConfiguration` TypeScript interfaces into `checkout-cart-data.ts` **verbatim**.
3. Expand “Obsługa dodawania zamówień” and “Obsługa statusu płatności”. Copy method, path relative to the merchant base URL, auth header name, and JSON request/response examples into `packages/furgonetka/src/fixtures/order-inbound.json` and `payment-inbound.json`.
4. Write Zod schemas in `inbound.ts` that parse those fixture files.
5. `parseInboundOrder` reads sku + quantity only from the captured payload (ignore any price fields Furgonetka echoes).
6. `mapProviderPaymentStatus`: map whatever payment strings appear in the payment fixture onto `PENDING | PAID | FAILED | CANCELLED`. Unknown string throws `Error("unknown furgonetka payment status")`.
7. `furgonetkaOrderUrl` for sandbox: `https://sandbox.furgonetka.pl` + the path shown in Furgonetka admin for an order. If docs give no path, use `https://sandbox.furgonetka.pl` as the button target until OAuth (Task 12).

If the Koszyk docs UI hides examples, save the sandbox JS (`universal-checkout-sandbox.js`) types and a HAR of one sandbox checkout instead. Do not invent field names.

Until capture is done, tests use this **adapter-owned** minimal shape so CI is not blocked. Replace it the moment fixtures exist — field names in `parseInboundOrder` must then match the fixtures, not this fallback:

```ts
// fallback test fixture only, deleted after capture
{
  "externalOrderId": "furgo_1",
  "items": [{ "sku": "TOWEL-BLUE", "quantity": 2 }]
}
```

```ts
{
  "externalOrderId": "furgo_1",
  "paymentStatus": "paid"
}
```

- [ ] **Step 1: Write failing tests**

`shared-key.test.ts`: `verifySharedKey("secret", "secret") === true`, `verifySharedKey("nope", "secret") === false`, `verifySharedKey(null, "secret") === false`. Use `crypto.timingSafeEqual` on equal-length buffers; return false on length mismatch.

`payment-status.test.ts`: `"paid" | "PAID" | "completed"` → `PAID`; `"failed"` → `FAILED`; `"cancelled"|"canceled"` → `CANCELLED`; `"pending"` → `PENDING`.

`map-checkout.test.ts`: `PreparedCheckout` with one line `19900 * 2` maps onto `CheckoutCartData` so that every money field Furgonetka expects is a number derived from grosze (divide by 100 **only here** if their type uses złoty).

`inbound.test.ts`: parse the fixture file into `CreateOrderCommand` with `items: [{ sku: "TOWEL-BLUE", quantity: 2 }]` and **no** `unitPrice` field.

- [ ] **Step 2: Run tests to verify they fail**

Add vitest to `@liteshop/furgonetka` the same way as core.

Run: `pnpm --filter @liteshop/furgonetka test`

Expected: FAIL missing modules.

- [ ] **Step 3: Implement verify/map/parse**

`verifySharedKey`:

```ts
import { timingSafeEqual } from "node:crypto";

export function verifySharedKey(
  headerValue: string | null,
  expected: string,
): boolean {
  if (headerValue === null) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @liteshop/furgonetka test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/furgonetka
git commit -m "$(cat <<'EOF'
feat: capture Furgonetka Koszyk contract and map onto core commands

EOF
)"
```

---

### Task 7: DynamoDB adapters

**Files:**
- Create: `packages/core/src/dynamo/keys.ts`
- Create: `packages/core/src/dynamo/dynamo-product-repository.ts`
- Create: `packages/core/src/dynamo/dynamo-inventory-repository.ts`
- Create: `packages/core/src/dynamo/dynamo-order-repository.ts`
- Create: `apps/web/src/lib/core.ts`

**Interfaces:**
- Consumes: repository ports from Tasks 1–4; ADR-001 keys
- Produces: Dynamo implementations of `ProductRepository`, `InventoryRepository`, `OrderRepository`

`packages/core/src/dynamo/keys.ts`:

```ts
export const keys = {
  shop: (shopId: string) => ({ pk: `SHOP#${shopId}`, sk: "META" }),
  product: (shopId: string, productId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `PRODUCT#${productId}`,
  }),
  productSlugGsi: (shopId: string, slug: string) => ({
    gsi1pk: `SHOP#${shopId}#SLUG`,
    gsi1sk: slug,
  }),
  inventory: (shopId: string, sku: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `INVENTORY#${sku}`,
  }),
  inventoryEvent: (shopId: string, eventId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `INVEVT#${eventId}`,
  }),
  order: (shopId: string, orderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `ORDER#${orderId}`,
  }),
  externalOrder: (shopId: string, externalOrderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `EXTORDER#${externalOrderId}`,
  }),
  reservation: (shopId: string, orderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `RESERVATION#${orderId}`,
    gsi1pk: `SHOP#${shopId}#RESERVATION`,
  }),
};
```

`InventoryRepository.save` for reserve uses DynamoDB `ConditionExpression` on the inventory item:

```text
attribute_not_exists(pk) OR (onHand - reserved >= :qty)
```

and a `TransactWrite` that also puts `RESERVATION#{orderId}` with `attribute_not_exists(pk)` so two concurrent last-unit buys cannot both commit.

Do **not** unit-test this adapter with real AWS. Core concurrency is already proven in Task 2. Optionally add a test that the `ConditionExpression` string constants exist.

`apps/web/src/lib/core.ts` builds `ProductService` / `InventoryService` / `CartService` / `OrderService` with Dynamo repos, `SystemClock`, `UlidGenerator`, table name from `Resource.Table.name`.

- [ ] **Step 1: Write `keys.ts` with a tiny test**

```ts
import { describe, expect, it } from "vitest";
import { keys } from "./keys.ts";

describe("keys", () => {
  it("scopes inventory to shop and sku", () => {
    expect(keys.inventory("shop_seed", "TOWEL-BLUE")).toEqual({
      pk: "SHOP#shop_seed",
      sk: "INVENTORY#TOWEL-BLUE",
    });
  });
});
```

- [ ] **Step 2: Run to fail, then implement keys + adapters + `core.ts`**

Run: `pnpm --filter @liteshop/core test src/dynamo/keys.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/core apps/web/src/lib/core.ts
git commit -m "$(cat <<'EOF'
feat: add DynamoDB adapters for products, inventory, and orders

EOF
)"
```

---

### Task 8: HTTP — prepare checkout + Koszyk inbound

**Files:**
- Create: `apps/web/src/pages/api/checkout/prepare.ts`
- Create: `apps/web/src/pages/api/furgonetka/[...path].ts`
- Create: `apps/web/src/lib/http.ts`

**Interfaces:**
- Consumes: `CartService.prepare`, `OrderService.createFromExternal`, `OrderService.applyPayment`, `verifySharedKey`, `parseInboundOrder`, `parseInboundPayment`, `mapProviderPaymentStatus`, `toCheckoutCartData`, `Resource.KoszykSharedKey.value`
- Produces:
  - `POST /api/checkout/prepare` body `{ items: CartItem[] }` → `200` `CheckoutCartData` or `409` `{ code, message }`
  - Inbound routes: whatever paths were captured in Task 6, mounted under `/api/furgonetka/*`. Auth header must match the captured header name. `401` if `verifySharedKey` fails. Order handler returns the JSON response shape from the Furgonetka order-inbound docs (not a LiteShop error page).

- [ ] **Step 1: Write a node test for the 409 mapping**

Create `apps/web/package.json` script `"test": "vitest run"` and `apps/web/src/lib/http.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DomainError } from "@liteshop/core";
import { toHttpError } from "./http.ts";

describe("toHttpError", () => {
  it("maps INSUFFICIENT_STOCK to 409", () => {
    const err = new DomainError("INSUFFICIENT_STOCK", "no stock");
    expect(toHttpError(err)).toEqual({
      status: 409,
      body: { code: "INSUFFICIENT_STOCK", message: "no stock" },
    });
  });
});
```

`toHttpError`: `INSUFFICIENT_STOCK` | `PRODUCT_INACTIVE` | `PRODUCT_NOT_FOUND` | `INVALID_CART` → 409. `ORDER_NOT_FOUND` → 404. unknown → 500 with message `"internal_error"` (do not leak stack).

- [ ] **Step 2: Run to fail, implement `toHttpError` and both API routes**

`prepare.ts` uses `SEED_SHOP_ID`, parses `{ items }` with Zod `{ sku: string, quantity: number.int().positive() }[]`, calls `cart.prepare`, returns `toCheckoutCartData`.

`[...path].ts`: verify key, switch on captured path. Order → `createFromExternal`. Payment → `mapProviderPaymentStatus` then `applyPayment`.

- [ ] **Step 3: Run `pnpm --filter @liteshop/web test` — PASS**

- [ ] **Step 4: Commit**

```bash
git add apps/web packages/furgonetka
git commit -m "$(cat <<'EOF'
feat: expose checkout prepare and Furgonetka inbound API routes

EOF
)"
```

---

### Task 9: Reservation expiry cron

**Files:**
- Modify: `apps/web/src/jobs/release-expired-reservations.ts`
- Test: `packages/core/src/inventory/inventory-service.test.ts` already covers `releaseExpired`; add a job unit test that calls `InventoryService.releaseExpired(SEED_SHOP_ID)`

**Interfaces:**
- Consumes: `InventoryService.releaseExpired`, `SEED_SHOP_ID`
- Produces: Cron handler returns `{ released: number }` and logs `reservation.release`

- [ ] **Step 1: Replace placeholder handler**

```ts
import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../lib/core.ts";

export async function handler() {
  const { stock, logger } = createServices();
  const released = await stock.releaseExpired(SEED_SHOP_ID);
  logger.info({
    shopId: SEED_SHOP_ID,
    operation: "reservation.release",
    correlationId: crypto.randomUUID(),
  });
  return { released };
}
```

Export `createServices()` from `apps/web/src/lib/core.ts` as `{ products, stock, cart, orders, logger }`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @liteshop/web typecheck`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/jobs/release-expired-reservations.ts apps/web/src/lib/core.ts
git commit -m "$(cat <<'EOF'
feat: release expired inventory reservations on a cron

EOF
)"
```

---

### Task 10: Hardcoded storefront + cart island

**Files:**
- Modify: `apps/web/src/pages/index.astro`
- Create: `apps/web/src/pages/products/[slug].astro`
- Create: `apps/web/src/pages/cart.astro`
- Create: `apps/web/src/islands/CartButton.tsx`
- Create: `apps/web/src/islands/CheckoutButton.tsx`
- Create: `apps/web/src/islands/cart-storage.ts`
- Modify: `apps/web/package.json` add `react`, `react-dom`, `@astrojs/react`
- Modify: `apps/web/astro.config.mjs` add `react()` integration

**Interfaces:**
- Consumes: `ProductService.listActive`, `getActiveBySlug`, `formatPln`, `toCheckoutCartData` via `/api/checkout/prepare`, Furgonetka sandbox script URL from docs
- Produces: localStorage key `liteshop.cart` with `{ items: CartItem[] }`; checkout island calls prepare then `Furgonetka.Checkout.init({ dataProviderCallback: () => prepared })`

`cart-storage.ts`:

```ts
export const CART_KEY = "liteshop.cart";

export interface CartItem {
  sku: string;
  quantity: number;
}

export function readCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as { items?: CartItem[] };
  return parsed.items ?? [];
}

export function writeCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify({ items }));
}
```

`CartButton.tsx` (client:load): on click, append `{ sku, quantity: 1 }` or increment, `writeCart`.

`CheckoutButton.tsx`:

```tsx
export function CheckoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        const items = readCart();
        const response = await fetch("/api/checkout/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { message: string };
          throw new Error(body.message);
        }
        const prepared = await response.json();
        window.Furgonetka.Checkout.init({
          dataProviderCallback: () => Promise.resolve(prepared),
        });
      }}
    >
      Kasa
    </button>
  );
}
```

Declare `interface Window { Furgonetka: { Checkout: { init: (cfg: unknown) => void } } }` in `apps/web/src/env.d.ts`.

Home lists active products with name, `formatPln(price)`, link to `/products/{slug}`. PDP shows add-to-cart. Cart page lists localStorage lines (names may be missing until prepare — show sku + qty) and `CheckoutButton`. Load sandbox script only on `cart.astro`:

```html
<script src="https://furgonetka.pl/js/dist/checkout/universal-checkout-sandbox.js" defer></script>
```

Pass captured `CheckoutInitConfiguration` fields from Task 6 (button container selectors, etc.).

Seed one product after first `sst dev` via a `apps/web/src/pages/api/dev/seed.ts` guarded by `import.meta.env.DEV`: create `TOWEL-BLUE` / `blue-towel` / 19900 / delivery 10. Delete this route before production stage.

- [ ] **Step 1: Add React integration and islands as above**

- [ ] **Step 2: Browser-check locally** — open `/`, add to cart, open `/cart`. Confirm `localStorage["liteshop.cart"]` is `{"items":[{"sku":"TOWEL-BLUE","quantity":1}]}`. Confirm prepare 200 when stock exists.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "$(cat <<'EOF'
feat: add hardcoded storefront cart that prepares checkout server-side

EOF
)"
```

---

### Task 11: Basic admin (password cookie)

**Files:**
- Create: `apps/web/src/lib/session.ts`
- Create: `apps/web/src/pages/api/admin/login.ts`
- Create: `apps/web/src/pages/admin/login.astro`
- Create: `apps/web/src/pages/admin/index.astro`
- Create: `apps/web/src/pages/admin/orders/index.astro`
- Create: `apps/web/src/pages/admin/orders/[id].astro`
- Create: `apps/web/src/pages/admin/products/index.astro`
- Create: `apps/web/src/pages/admin/inventory/index.astro`
- Create: `apps/web/src/pages/api/admin/inventory.ts`
- Create: `sst` secret `AdminPassword`

**Interfaces:**
- Consumes: `OrderService.list/get`, `ProductService`, `InventoryService.applyDelivery/applyAdjustment`, `available()`, `furgonetkaOrderUrl`
- Produces: cookie `ls_session` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`) with value `HMAC(admin)` using `AdminPassword`. Unauthenticated `/admin/*` redirects to `/admin/login`.

Dashboard copy from PRD §35: today's order count, unpaid count, low stock (`available < 5`). Orders table: id, paymentStatus, shippingStatus, `formatPln(total)`. Order detail: items, total, `[ Otwórz w Furgonetce ]` linking `furgonetkaOrderUrl(externalOrderId)`. Inventory: Na stanie / Zarezerwowane / Dostępne, buttons posting `{ sku, quantity, reason: "DELIVERY" | "ADJUSTMENT" }`.

- [ ] **Step 1: Add `AdminPassword` secret to `sst.config.ts` `link` array and login route**

`session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ls_session";

export function signAdminSession(secret: string): string {
  return createHmac("sha256", secret).update("admin").digest("hex");
}

export function isAdminSession(cookieValue: string | undefined, secret: string): boolean {
  if (!cookieValue) return false;
  const expected = Buffer.from(signAdminSession(secret));
  const actual = Buffer.from(cookieValue);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
```

Login POST compares password with `Resource.AdminPassword.value` via `timingSafeEqual` on hashed buffers (hash both with sha256 first so lengths match).

- [ ] **Step 2: Browser-check dashboard, order list, inventory delivery +10**

- [ ] **Step 3: Commit**

```bash
git add apps/web sst.config.ts
git commit -m "$(cat <<'EOF'
feat: add password-protected admin for orders, products, and inventory

EOF
)"
```

---

### Task 12: Furgonetka OAuth connect + admin login

**Files:**
- Create: `packages/furgonetka/src/oauth/oauth.ts`
- Test: `packages/furgonetka/src/oauth/oauth.test.ts`
- Create: `apps/web/src/pages/api/admin/furgonetka/start.ts`
- Create: `apps/web/src/pages/api/admin/furgonetka/callback.ts`
- Create: `packages/core/src/connection/furgonetka-connection.ts`
- Modify: `apps/web/src/pages/admin/login.astro` — primary button “Zaloguj przez Furgonetkę”; keep password login behind `import.meta.env.DEV`

**Interfaces:**
- Consumes: https://furgonetka.pl/api/oauth (`authorization_code`, refresh)
- Produces:

```ts
export interface FurgonetkaConnection {
  shopId: ShopId;
  accountId: string;
  refreshTokenCiphertext: string;
  connectedAt: Date;
  status: "connected" | "disconnected";
}

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string; // https://api.furgonetka.pl/oauth/authorize?response_type=code&...

export function parseTokenResponse(json: unknown): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
```

Store only the encrypted refresh token. Use `sst.Secret("TokenEncryptionKey")` (32-byte value) and `crypto.createCipheriv("aes-256-gcm", ...)`. Do not add KMS in MVP. Never send Furgonetka tokens to the browser. After callback, issue the same `ls_session` cookie as Task 11.

Add secrets: `FurgonetkaClientId`, `FurgonetkaClientSecret`, `TokenEncryptionKey`.

OAuth `state` is a CSRF nonce stored in a short-lived HttpOnly cookie `ls_oauth_state`.

- [ ] **Step 1: Test `buildAuthorizeUrl` contains `response_type=code` and the redirect URI**

- [ ] **Step 2: Implement routes; connection item at `SHOP#{id}/FURGONETKA`**

- [ ] **Step 3: Commit**

```bash
git add packages/furgonetka packages/core apps/web sst.config.ts
git commit -m "$(cat <<'EOF'
feat: connect Furgonetka via OAuth and issue a LiteShop admin session

EOF
)"
```

---

## Not in this phase

- Store Definition / renderer / preview path (`/preview`, [ADR-004](../../adr/0004-preview-renders-draft.md)) — Phase 2.
- LLM — Phase 3.
- Shipping-status inbound: implement with the same shared-key + idempotent `applyShipping` pattern as payment **after** the paid-order gate, still in `@liteshop/furgonetka` mapping onto `OrderMirror.shipping`. Do not block the Phase 1 gate on it.

## Phase 1 gate

A real sandbox purchase, not a mocked handler:

1. Seed `TOWEL-BLUE` with `onHand >= 1`.
2. Storefront add to cart → Kasa → Furgonetka Koszyk sandbox payment.
3. Admin shows Order Mirror `paymentStatus: PAID`.
4. Inventory `onHand` decreased by the bought quantity exactly once.
5. Replay the payment inbound request (same body, same key) → `onHand` unchanged.
6. `pnpm test` green for core + furgonetka + web.

Do not start Phase 2 until step 2–5 are evidenced (log lines with `operation: "payment.apply"` and the admin screenshot or curl of `GET` order JSON).

Next: [2026-08-24-liteshop-phase-2-store-definition.md](./2026-08-24-liteshop-phase-2-store-definition.md)
