import type { OrderId, ShopId, Sku } from "./ids.ts";

export interface CommerceLog {
  shopId: ShopId;
  operation:
    | "order.create"
    | "order.create.duplicate"
    | "payment.apply"
    | "reservation.release"
    | "checkout.prepare"
    | "furgonetka.inbound";
  orderId?: OrderId;
  externalOrderId?: string;
  sku?: Sku;
  correlationId: string;
}

export interface Logger {
  info(event: CommerceLog): void;
  error(event: CommerceLog, error: unknown): void;
}

const SECRET_KEYS = new Set([
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "sharedKey",
]);

function sanitize(event: CommerceLog): CommerceLog {
  const payload: CommerceLog = {
    shopId: event.shopId,
    operation: event.operation,
    correlationId: event.correlationId,
  };
  if (event.orderId !== undefined) payload.orderId = event.orderId;
  if (event.externalOrderId !== undefined) payload.externalOrderId = event.externalOrderId;
  if (event.sku !== undefined) payload.sku = event.sku;
  for (const key of Object.keys(payload) as (keyof CommerceLog)[]) {
    if (SECRET_KEYS.has(String(key))) {
      delete payload[key];
    }
  }
  return payload;
}

export function createJsonLogger(write?: (line: string) => void): Logger {
  const out = write ?? ((line: string) => console.log(line));
  return {
    info(event) {
      out(JSON.stringify(sanitize(event)));
    },
    error(event, error) {
      const message = error instanceof Error ? error.message : String(error);
      out(JSON.stringify({ ...sanitize(event), error: message }));
    },
  };
}
