import {
  DomainError,
  type ApplyPaymentCommand,
  type ApplyTrackingCommand,
  type CreateOrderCommand,
  type OrderMirror,
  type ShopId,
} from "@liteshop/core";
import { z } from "zod";
import {
  parseAddOrder,
  parseAddPayment,
  parseTrackingNumber,
  toOrderOut,
} from "./inbound.ts";
import { UnknownPaymentStatusError } from "./payment-status.ts";
import { parseFurgonetkaRoute } from "./shop-api.ts";
import { verifySharedKey } from "./shared-key.ts";

export interface InboundOrderPort {
  listSince(
    shopId: ShopId,
    datetime: string | undefined,
    limit: number,
  ): Promise<OrderMirror[]>;
  createFromExternal(
    cmd: CreateOrderCommand,
  ): Promise<{ order: OrderMirror; created: boolean }>;
  applyPayment(cmd: ApplyPaymentCommand): Promise<OrderMirror>;
  applyTracking(cmd: ApplyTrackingCommand): Promise<OrderMirror>;
}

export interface InboundRequest {
  method: "GET" | "POST";
  path: string;
  authHeader: string | null;
  expectedKey: string;
  shopId: ShopId;
  body: unknown;
  datetime: string | undefined;
  limit: string | null;
  orders: InboundOrderPort;
}

export interface InboundResponse {
  status: number;
  body: unknown;
}

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? "100");
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.trunc(n), 100);
}

export async function handleFurgonetkaInbound(
  input: InboundRequest,
): Promise<InboundResponse> {
  if (!verifySharedKey(input.authHeader, input.expectedKey)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  const route = parseFurgonetkaRoute(input.path);
  if (!route) {
    return { status: 404, body: { error: "not_found" } };
  }
  try {
    if (input.method === "GET") {
      if (route.kind !== "orders-collection") {
        return { status: 404, body: { error: "not_found" } };
      }
      const listed = await input.orders.listSince(
        input.shopId,
        input.datetime,
        parseLimit(input.limit),
      );
      return { status: 200, body: listed.map(toOrderOut) };
    }
    if (route.kind === "orders-collection") {
      const cmd = parseAddOrder(input.body, input.shopId);
      const result = await input.orders.createFromExternal(cmd);
      return { status: 200, body: toOrderOut(result.order) };
    }
    if (route.kind === "orders-payments") {
      const cmd = parseAddPayment(input.body, input.shopId, route.sourceOrderId);
      await input.orders.applyPayment(cmd);
      return { status: 200, body: null };
    }
    const cmd = parseTrackingNumber(input.body, input.shopId, route.sourceOrderId);
    await input.orders.applyTracking(cmd);
    return { status: 200, body: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 400, body: { error: "invalid_body" } };
    }
    if (error instanceof UnknownPaymentStatusError) {
      return { status: 400, body: { error: "invalid_payment_status" } };
    }
    if (error instanceof DomainError && error.code === "ORDER_NOT_FOUND") {
      return { status: 404, body: { error: "not_found" } };
    }
    return { status: 500, body: { error: "internal_error" } };
  }
}
