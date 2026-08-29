import type { Clock } from "../clock.ts";
import { DomainError, InsufficientStockError } from "../errors.ts";
import type { IdGenerator, OrderId, ShopId, Sku } from "../ids.ts";
import type { Inventory, Reservation } from "./inventory.ts";
import type { InventoryRepository } from "./inventory-repository.ts";

export const DEFAULT_RESERVATION_TTL_MS = 20 * 60 * 1000;

export class InventoryService {
  private readonly repo: InventoryRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly reservationTtlMs: number;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(deps: {
    inventory: InventoryRepository;
    clock: Clock;
    ids: IdGenerator;
    reservationTtlMs?: number;
  }) {
    this.repo = deps.inventory;
    this.clock = deps.clock;
    this.ids = deps.ids;
    this.reservationTtlMs = deps.reservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS;
  }

  async applyDelivery(shopId: ShopId, sku: Sku, quantity: number): Promise<Inventory> {
    if (quantity <= 0) {
      throw new DomainError("INVALID_QUANTITY", "delivery quantity must be positive");
    }
    const current = (await this.repo.get(shopId, sku)) ?? {
      shopId,
      sku,
      onHand: 0,
      reserved: 0,
    };
    current.onHand += quantity;
    await this.repo.save(current);
    await this.repo.appendEvent({
      id: this.ids.eventId(),
      shopId,
      sku,
      deltaOnHand: quantity,
      deltaReserved: 0,
      reason: "DELIVERY",
      createdAt: this.clock.now(),
    });
    return current;
  }

  async applyAdjustment(
    shopId: ShopId,
    sku: Sku,
    deltaOnHand: number,
  ): Promise<Inventory> {
    const current = (await this.repo.get(shopId, sku)) ?? {
      shopId,
      sku,
      onHand: 0,
      reserved: 0,
    };
    if (current.onHand + deltaOnHand < current.reserved) {
      throw new DomainError(
        "INVALID_ADJUSTMENT",
        "adjustment would make onHand less than reserved",
      );
    }
    current.onHand += deltaOnHand;
    await this.repo.save(current);
    await this.repo.appendEvent({
      id: this.ids.eventId(),
      shopId,
      sku,
      deltaOnHand,
      deltaReserved: 0,
      reason: "ADJUSTMENT",
      createdAt: this.clock.now(),
    });
    return current;
  }

  async reserve(
    shopId: ShopId,
    sku: Sku,
    quantity: number,
    orderId: OrderId,
  ): Promise<Reservation> {
    const mutexKey = `${shopId}#${sku}`;
    const run = async () => {
      const inv = await this.repo.get(shopId, sku);
      const current = inv ?? { shopId, sku, onHand: 0, reserved: 0 };
      if (current.onHand - current.reserved < quantity) {
        throw new InsufficientStockError(sku, quantity);
      }
      const existing = await this.repo.getReservation(shopId, orderId);
      if (existing) return existing;
      const reservation: Reservation = {
        shopId,
        orderId,
        sku,
        quantity,
        status: "open",
        expiresAt: new Date(this.clock.now().getTime() + this.reservationTtlMs),
      };
      const event = {
        id: this.ids.eventId(),
        shopId,
        sku,
        deltaOnHand: 0,
        deltaReserved: quantity,
        reason: "RESERVATION" as const,
        orderId,
        createdAt: this.clock.now(),
      };
      if (this.repo.transactReserve) {
        try {
          await this.repo.transactReserve({
            inventory: current,
            quantity,
            reservation,
            event,
          });
        } catch {
          throw new InsufficientStockError(sku, quantity);
        }
        return reservation;
      }
      current.reserved += quantity;
      await this.repo.save(current);
      await this.repo.saveReservation(reservation);
      await this.repo.appendEvent(event);
      return reservation;
    };
    const previous = this.locks.get(mutexKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(mutexKey, previous.then(() => current));
    await previous;
    try {
      return await run();
    } finally {
      release();
    }
  }

  async confirmSale(shopId: ShopId, orderId: OrderId): Promise<void> {
    const reservation = await this.repo.getReservation(shopId, orderId);
    if (!reservation) {
      throw new DomainError("RESERVATION_NOT_FOUND", `reservation not found: ${orderId}`);
    }
    if (reservation.status !== "open") {
      return;
    }
    const inv = await this.repo.get(shopId, reservation.sku);
    if (!inv) {
      throw new DomainError("INVENTORY_NOT_FOUND", `inventory not found: ${reservation.sku}`);
    }
    const qty = reservation.quantity;
    inv.onHand -= qty;
    inv.reserved -= qty;
    reservation.status = "sold";
    await this.repo.save(inv);
    await this.repo.saveReservation(reservation);
    await this.repo.appendEvent({
      id: this.ids.eventId(),
      shopId,
      sku: reservation.sku,
      deltaOnHand: -qty,
      deltaReserved: -qty,
      reason: "SALE",
      orderId,
      createdAt: this.clock.now(),
    });
  }

  async release(shopId: ShopId, orderId: OrderId): Promise<void> {
    const reservation = await this.repo.getReservation(shopId, orderId);
    if (!reservation || reservation.status !== "open") {
      return;
    }
    const inv = await this.repo.get(shopId, reservation.sku);
    if (!inv) {
      throw new DomainError("INVENTORY_NOT_FOUND", `inventory not found: ${reservation.sku}`);
    }
    const qty = reservation.quantity;
    inv.reserved -= qty;
    reservation.status = "released";
    await this.repo.save(inv);
    await this.repo.saveReservation(reservation);
    await this.repo.appendEvent({
      id: this.ids.eventId(),
      shopId,
      sku: reservation.sku,
      deltaOnHand: 0,
      deltaReserved: -qty,
      reason: "RESERVATION_RELEASED",
      orderId,
      createdAt: this.clock.now(),
    });
  }

  async releaseExpired(shopId: ShopId): Promise<number> {
    const expired = await this.repo.listOpenExpired(shopId, this.clock.now());
    for (const reservation of expired) {
      await this.release(shopId, reservation.orderId);
    }
    return expired.length;
  }
}
