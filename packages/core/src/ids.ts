import { randomBytes } from "node:crypto";

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

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number): string {
  let value = now;
  let out = "";
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function encodeRandom(): string {
  const bytes = randomBytes(10);
  let acc = 0;
  let bits = 0;
  let out = "";
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(acc >> bits) & 31];
    }
  }
  return out;
}

export function ulid(now = Date.now()): string {
  return encodeTime(now) + encodeRandom();
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
