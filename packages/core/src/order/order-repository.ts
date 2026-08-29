import type { OrderId, ShopId } from "../ids.ts";
import type { OrderMirror } from "./order.ts";

export interface OrderRepository {
  getById(shopId: ShopId, orderId: OrderId): Promise<OrderMirror | undefined>;
  getByExternalId(shopId: ShopId, externalOrderId: string): Promise<OrderMirror | undefined>;
  save(order: OrderMirror): Promise<void>;
  list(shopId: ShopId): Promise<OrderMirror[]>;
}
