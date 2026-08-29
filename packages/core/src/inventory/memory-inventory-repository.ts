import type { OrderId, ShopId, Sku } from "../ids.ts";
import type { Inventory, InventoryEvent, Reservation } from "./inventory.ts";
import type { InventoryRepository } from "./inventory-repository.ts";

function invKey(shopId: ShopId, sku: Sku): string {
  return `${shopId}#${sku}`;
}

function resKey(shopId: ShopId, orderId: OrderId): string {
  return `${shopId}#${orderId}`;
}

export class MemoryInventoryRepository implements InventoryRepository {
  private readonly bySku = new Map<string, Inventory>();
  private readonly events: InventoryEvent[] = [];
  private readonly reservations = new Map<string, Reservation>();

  async get(shopId: ShopId, sku: Sku) {
    const found = this.bySku.get(invKey(shopId, sku));
    return found ? { ...found } : undefined;
  }

  async save(inventory: Inventory) {
    this.bySku.set(invKey(inventory.shopId, inventory.sku), { ...inventory });
  }

  async appendEvent(event: InventoryEvent) {
    this.events.push(event);
  }

  async listEvents(shopId: ShopId, sku: Sku) {
    return this.events.filter((e) => e.shopId === shopId && e.sku === sku);
  }

  async getReservation(shopId: ShopId, orderId: OrderId) {
    const found = this.reservations.get(resKey(shopId, orderId));
    return found ? { ...found, expiresAt: new Date(found.expiresAt) } : undefined;
  }

  async saveReservation(reservation: Reservation) {
    this.reservations.set(resKey(reservation.shopId, reservation.orderId), {
      ...reservation,
      expiresAt: new Date(reservation.expiresAt),
    });
  }

  async listOpenExpired(shopId: ShopId, now: Date) {
    return [...this.reservations.values()]
      .filter(
        (r) =>
          r.shopId === shopId &&
          r.status === "open" &&
          r.expiresAt.getTime() <= now.getTime(),
      )
      .map((r) => ({ ...r, expiresAt: new Date(r.expiresAt) }));
  }
}
