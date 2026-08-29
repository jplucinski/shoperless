import type { OrderId, ShopId } from "../ids.ts";
import type { OrderMirror } from "./order.ts";
import type { OrderRepository } from "./order-repository.ts";

function idKey(shopId: ShopId, orderId: OrderId): string {
  return `${shopId}#${orderId}`;
}

function extKey(shopId: ShopId, externalOrderId: string): string {
  return `${shopId}#${externalOrderId}`;
}

export class MemoryOrderRepository implements OrderRepository {
  private readonly byId = new Map<string, OrderMirror>();
  private readonly byExternal = new Map<string, OrderId>();

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
}
