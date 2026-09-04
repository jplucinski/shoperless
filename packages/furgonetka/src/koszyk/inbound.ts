import type {
  ApplyPaymentCommand,
  ApplyTrackingCommand,
  CreateOrderCommand,
  OrderMirror,
  ShippingAddress,
  ShopId,
} from "@liteshop/core";
import { z } from "zod";
import { mapProviderPaymentStatus } from "./payment-status.ts";
import {
  addOrderInSchema,
  addPaymentInSchema,
  type OrderOut,
  trackingNumberInSchema,
} from "./shop-api.ts";

function zlToGrosze(zl: number): number {
  return Math.round(zl * 100);
}

function groszeToZl(grosze: number): number {
  return grosze / 100;
}

function mapShippingAddress(input: z.infer<typeof addOrderInSchema>["shippingAddress"]): ShippingAddress {
  return {
    street: input.street,
    city: input.city,
    postcode: input.postcode,
    countryCode: input.countryCode,
    phone: input.phone,
    email: input.email,
    company: input.company ?? null,
    name: input.name ?? null,
    surname: input.surname ?? null,
  };
}

export function parseAddOrder(body: unknown, shopId: ShopId): CreateOrderCommand {
  const parsed = addOrderInSchema.parse(body);
  return {
    shopId,
    cartId: parsed.cartId,
    items: parsed.products.map((product) => ({
      sku: product.sourceProductId,
      quantity: Math.round(product.quantity),
    })),
    shippingAddress: mapShippingAddress(parsed.shippingAddress),
    codAmount: parsed.codAmount !== undefined ? zlToGrosze(parsed.codAmount) : 0,
    datetimeOrder: parsed.datetimeOrder,
    service: parsed.service,
    pickupPoint: parsed.point,
    comment: parsed.comment,
  };
}

export function parseAddPayment(
  body: unknown,
  shopId: ShopId,
  sourceOrderId: string,
): ApplyPaymentCommand {
  const parsed = addPaymentInSchema.parse(body);
  return {
    shopId,
    orderId: sourceOrderId,
    paymentStatus: mapProviderPaymentStatus(parsed.paymentStatus),
    paidAmount: zlToGrosze(parsed.paidAmount),
  };
}

export function parseTrackingNumber(
  body: unknown,
  shopId: ShopId,
  sourceOrderId: string,
): ApplyTrackingCommand {
  const parsed = trackingNumberInSchema.parse(body);
  return {
    shopId,
    orderId: sourceOrderId,
    trackingNumber: parsed.tracking.number,
    courierService: parsed.tracking.courierService,
  };
}

export function toOrderOut(order: OrderMirror): OrderOut {
  const status =
    order.paymentStatus === "PAID"
      ? "paid"
      : order.paymentStatus === "FAILED"
        ? "failed"
        : order.paymentStatus === "CANCELLED"
          ? "cancelled"
          : "pending";

  return {
    sourceOrderId: order.id,
    datetimeOrder: order.createdAt.toISOString(),
    totalPrice: groszeToZl(order.total),
    totalPaid: groszeToZl(order.totalPaid),
    codAmount: groszeToZl(order.codAmount),
    shippingAddress: order.shippingAddress,
    products: order.items.map((item) => ({
      sourceProductId: item.sku,
      name: item.name ?? item.sku,
      priceGross: groszeToZl(item.unitPrice),
      quantity: item.quantity,
      sku: item.sku,
    })),
    status,
    service: order.courierService ?? null,
    point: order.pickupPoint ?? null,
    comment: order.comment ?? null,
    sourceDatetimeChange: order.createdAt.toISOString(),
  };
}

export function furgonetkaOrderUrl(sourceOrderId: string): string {
  void sourceOrderId;
  return "https://sandbox.furgonetka.pl";
}
