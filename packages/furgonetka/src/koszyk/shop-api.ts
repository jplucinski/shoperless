import { z } from "zod";

/** OpenAPI: universal-integration-structure-documentation.yaml */

export const shippingAddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  postcode: z.string().min(1),
  countryCode: z.string().min(2),
  phone: z.string().min(1),
  email: z.string().email(),
  company: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  surname: z.string().nullable().optional(),
});

export const checkoutProductSchema = z.object({
  sourceProductId: z.string().min(1),
  stockId: z.string().optional(),
  quantity: z.number().positive(),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        id: z.string().optional(),
        valueId: z.string().optional(),
      }),
    )
    .optional(),
});

export const addOrderInSchema = z.object({
  cartId: z.string().optional(),
  datetimeOrder: z.string().optional(),
  service: z.string().optional(),
  point: z.string().optional(),
  codAmount: z.number().optional(),
  comment: z.string().optional(),
  payment: z.object({ id: z.string() }).optional(),
  shipping: z.object({ id: z.string() }).optional(),
  shippingAddress: shippingAddressSchema,
  invoiceAddress: shippingAddressSchema.optional(),
  products: z.array(checkoutProductSchema).min(1),
});

export const addPaymentInSchema = z.object({
  paymentStatus: z.string().min(1),
  paidAmount: z.number(),
});

export const trackingNumberInSchema = z.object({
  tracking: z.object({
    number: z.string().min(1),
    courierService: z.string().min(1),
  }),
});

export type AddOrderIn = z.infer<typeof addOrderInSchema>;
export type AddPaymentIn = z.infer<typeof addPaymentInSchema>;
export type ShippingAddressIn = z.infer<typeof shippingAddressSchema>;

export interface OrderOutProduct {
  sourceProductId: string;
  name: string;
  priceGross: number;
  quantity: number;
  sku?: string | null;
}

export interface OrderOut {
  sourceOrderId: string;
  datetimeOrder: string;
  totalPrice: number;
  totalPaid: number;
  codAmount: number;
  shippingAddress: ShippingAddressIn;
  products: OrderOutProduct[];
  sourceClientId?: number | null;
  sourceDatetimeChange?: string | null;
  service?: string | null;
  serviceDescription?: string | null;
  status?: string | null;
  shippingCost?: number | null;
  comment?: string | null;
  paymentDatetime?: string | null;
  point?: string | null;
}

export type FurgonetkaRoute =
  | { kind: "orders-collection" }
  | { kind: "orders-payments"; sourceOrderId: string }
  | { kind: "orders-tracking"; sourceOrderId: string };

export function parseFurgonetkaRoute(path: string): FurgonetkaRoute | undefined {
  if (path === "orders") {
    return { kind: "orders-collection" };
  }
  const payments = path.match(/^orders\/([^/]+)\/payments$/);
  if (payments) {
    return { kind: "orders-payments", sourceOrderId: payments[1]! };
  }
  const tracking = path.match(/^orders\/([^/]+)\/tracking_number$/);
  if (tracking) {
    return { kind: "orders-tracking", sourceOrderId: tracking[1]! };
  }
  return undefined;
}
