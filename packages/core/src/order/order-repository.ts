import type { Inventory, InventoryEvent, Reservation } from "../inventory/inventory.ts";
import type { OrderId, ShopId } from "../ids.ts";
import type { Money } from "../money.ts";
import type { OrderMirror } from "./order.ts";

export type ReserveLineTransact = {
  inventory: Inventory;
  quantity: number;
  reservation: Reservation;
  event: InventoryEvent;
};

export type ConfirmSaleLineTransact = {
  inventory: Inventory;
  reservation: Reservation;
  saleEvent: InventoryEvent;
};

export interface OrderRepository {
  getById(shopId: ShopId, orderId: OrderId): Promise<OrderMirror | undefined>;
  getByExternalId(shopId: ShopId, externalOrderId: string): Promise<OrderMirror | undefined>;
  save(order: OrderMirror): Promise<void>;
  list(shopId: ShopId): Promise<OrderMirror[]>;
  transactCreateOrder?(input: {
    order: OrderMirror;
    reserveLines: ReserveLineTransact[];
  }): Promise<"created" | "duplicate">;
  transactConfirmPayment?(input: {
    order: OrderMirror;
    paidAmount: Money;
    lines: ConfirmSaleLineTransact[];
  }): Promise<"confirmed" | "already_paid">;
  transactReleaseReservation?(input: {
    order: OrderMirror;
    reservation: Reservation;
    inventory: Inventory;
    event: InventoryEvent;
  }): Promise<"released" | "skipped">;
}
