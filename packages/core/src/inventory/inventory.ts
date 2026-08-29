import type { OrderId, ShopId, Sku } from "../ids.ts";

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
