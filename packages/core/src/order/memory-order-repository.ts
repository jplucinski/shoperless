import { InsufficientStockError } from "../errors.ts";
import type { Inventory, InventoryEvent, Reservation } from "../inventory/inventory.ts";
import type { OrderId, ShopId } from "../ids.ts";
import type { Money } from "../money.ts";
import type { OrderMirror } from "./order.ts";
import type {
  ConfirmSaleLineTransact,
  OrderRepository,
  ReserveLineTransact,
} from "./order-repository.ts";
import type { InventoryRepository } from "../inventory/inventory-repository.ts";

function idKey(shopId: ShopId, orderId: OrderId): string {
  return `${shopId}#${orderId}`;
}

function extKey(shopId: ShopId, externalOrderId: string): string {
  return `${shopId}#${externalOrderId}`;
}

export class MemoryOrderRepository implements OrderRepository {
  constructor(private readonly inventory?: InventoryRepository) {}

  private readonly byId = new Map<string, OrderMirror>();
  private readonly byExternal = new Map<string, OrderId>();
  private readonly locks = new Map<string, Promise<void>>();

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, previous.then(() => current));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async getById(shopId: ShopId, orderId: OrderId) {
    const found = this.byId.get(idKey(shopId, orderId));
    return found ? structuredClone(found) : undefined;
  }

  async getByExternalId(shopId: ShopId, externalOrderId: string) {
    const orderId = this.byExternal.get(extKey(shopId, externalOrderId));
    if (!orderId) return undefined;
    return this.getById(shopId, orderId);
  }

  async save(order: OrderMirror) {
    const copy = structuredClone(order);
    this.byId.set(idKey(order.shopId, order.id), copy);
    this.byExternal.set(extKey(order.shopId, order.externalOrderId), order.id);
  }

  async list(shopId: ShopId) {
    return [...this.byId.values()]
      .filter((o) => o.shopId === shopId)
      .map((o) => structuredClone(o));
  }

  async transactCreateOrder(input: {
    order: OrderMirror;
    reserveLines: ReserveLineTransact[];
  }): Promise<"created" | "duplicate"> {
    if (!this.inventory) {
      throw new Error("MemoryOrderRepository.transactCreateOrder requires inventory");
    }
    const ext = extKey(input.order.shopId, input.order.externalOrderId);
    return this.withLock(ext, async () => {
      if (this.byExternal.has(ext)) {
        return "duplicate";
      }
      for (const line of input.reserveLines) {
        const current =
          (await this.inventory!.get(line.inventory.shopId, line.inventory.sku)) ??
          line.inventory;
        if (current.onHand - current.reserved < line.quantity) {
          throw new InsufficientStockError(line.reservation.sku, line.quantity);
        }
      }
      for (const line of input.reserveLines) {
        const current =
          (await this.inventory!.get(line.inventory.shopId, line.inventory.sku)) ??
          line.inventory;
        current.reserved += line.quantity;
        current.version += 1;
        await this.inventory!.save(current);
        await this.inventory!.saveReservation(line.reservation);
        await this.inventory!.appendEvent(line.event);
      }
      await this.save(input.order);
      return "created";
    });
  }

  async transactConfirmPayment(input: {
    order: OrderMirror;
    paidAmount: Money;
    lines: ConfirmSaleLineTransact[];
  }): Promise<"confirmed" | "already_paid"> {
    if (!this.inventory) {
      throw new Error("MemoryOrderRepository.transactConfirmPayment requires inventory");
    }
    const lockKey = idKey(input.order.shopId, input.order.id);
    return this.withLock(lockKey, async () => {
      const current = await this.getById(input.order.shopId, input.order.id);
      if (!current || current.paymentStatus === "PAID") {
        return "already_paid";
      }
      for (const line of input.lines) {
        await applyConfirmSaleLine(this.inventory!, line);
      }
      current.paymentStatus = "PAID";
      current.totalPaid = input.paidAmount;
      await this.save(current);
      return "confirmed";
    });
  }

  async transactReleaseReservation(input: {
    order: OrderMirror;
    reservation: Reservation;
    inventory: Inventory;
    event: InventoryEvent;
  }): Promise<"released" | "skipped"> {
    if (!this.inventory) {
      throw new Error("MemoryOrderRepository.transactReleaseReservation requires inventory");
    }
    const lockKey = idKey(input.order.shopId, input.order.id);
    return this.withLock(lockKey, async () => {
      const current = await this.getById(input.order.shopId, input.order.id);
      if (!current || current.paymentStatus === "PAID") {
        return "skipped";
      }
      const reservation = await this.inventory!.getReservationLine(
        input.reservation.shopId,
        input.reservation.orderId,
        input.reservation.sku,
      );
      if (!reservation || reservation.status !== "open") {
        return "skipped";
      }
      const inv =
        (await this.inventory!.get(input.inventory.shopId, input.inventory.sku)) ??
        input.inventory;
      inv.reserved -= reservation.quantity;
      inv.version += 1;
      reservation.status = "released";
      await this.inventory!.save(inv);
      await this.inventory!.saveReservation(reservation);
      await this.inventory!.appendEvent(input.event);
      return "released";
    });
  }
}

async function applyConfirmSaleLine(
  inventory: InventoryRepository,
  line: ConfirmSaleLineTransact,
): Promise<void> {
  const reservation = await inventory.getReservationLine(
    line.reservation.shopId,
    line.reservation.orderId,
    line.reservation.sku,
  );
  if (!reservation || reservation.status === "sold") {
    return;
  }
  const inv =
    (await inventory.get(line.inventory.shopId, line.inventory.sku)) ?? line.inventory;
  const qty = reservation.quantity;
  if (reservation.status === "open") {
    inv.onHand -= qty;
    inv.reserved -= qty;
  } else if (reservation.status === "released") {
    inv.onHand -= qty;
  } else {
    return;
  }
  inv.version += 1;
  reservation.status = "sold";
  await inventory.save(inv);
  await inventory.saveReservation(reservation);
  await inventory.appendEvent(line.saleEvent);
}
