import type {
  ApplyPaymentCommand,
  CreateOrderCommand,
  ShopId,
} from "@liteshop/core";
import { z } from "zod";
import { mapProviderPaymentStatus } from "./payment-status.ts";

export const INBOUND_ORDER_PATH = "orders";
export const INBOUND_PAYMENT_PATH = "payments";

const orderInboundSchema = z.object({
  externalOrderId: z.string().min(1),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

const paymentInboundSchema = z.object({
  externalOrderId: z.string().min(1),
  paymentStatus: z.string().min(1),
});

export function parseInboundOrder(body: unknown, shopId: ShopId): CreateOrderCommand {
  const parsed = orderInboundSchema.parse(body);
  return {
    shopId,
    externalOrderId: parsed.externalOrderId,
    items: parsed.items.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
    })),
  };
}

export function parseInboundPayment(
  body: unknown,
  shopId: ShopId,
): ApplyPaymentCommand {
  const parsed = paymentInboundSchema.parse(body);
  return {
    shopId,
    externalOrderId: parsed.externalOrderId,
    paymentStatus: mapProviderPaymentStatus(parsed.paymentStatus),
  };
}

export function furgonetkaOrderUrl(externalOrderId: string): string {
  void externalOrderId;
  return "https://sandbox.furgonetka.pl";
}

export function inboundOrderResponse(externalOrderId: string): { ok: true; externalOrderId: string } {
  return { ok: true, externalOrderId };
}

export function inboundPaymentResponse(externalOrderId: string): { ok: true; externalOrderId: string } {
  return { ok: true, externalOrderId };
}
