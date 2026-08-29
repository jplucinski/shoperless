import { ulid } from "ulidx";

export type ShopId = string;
export type ProductId = string;
export type Sku = string;
export type OrderId = string;

export const SEED_SHOP_ID: ShopId = "shop_seed";

export interface IdGenerator {
  productId(): ProductId;
  orderId(): OrderId;
  eventId(): string;
}

export class UlidGenerator implements IdGenerator {
  productId(): ProductId {
    return `prd_${ulid()}`;
  }
  orderId(): OrderId {
    return `ord_${ulid()}`;
  }
  eventId(): string {
    return `evt_${ulid()}`;
  }
}
