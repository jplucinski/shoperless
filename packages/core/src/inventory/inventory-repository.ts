import type { OrderId, ShopId, Sku } from "../ids.ts";
import type { Inventory, InventoryEvent, Reservation } from "./inventory.ts";

export interface InventoryRepository {
  get(shopId: ShopId, sku: Sku): Promise<Inventory | undefined>;
  save(inventory: Inventory): Promise<void>;
  appendEvent(event: InventoryEvent): Promise<void>;
  listEvents(shopId: ShopId, sku: Sku): Promise<InventoryEvent[]>;
  getReservation(shopId: ShopId, orderId: OrderId): Promise<Reservation | undefined>;
  saveReservation(reservation: Reservation): Promise<void>;
  listOpenExpired(shopId: ShopId, now: Date): Promise<Reservation[]>;
}
