import type { OrderId, ShopId, Sku } from "../ids.ts";
import type { Money } from "../money.ts";
import type { CartItem } from "../cart/cart.ts";

export type OrderStatus = "CREATED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type ShippingStatus = "NOT_SHIPPED" | "IN_TRANSIT" | "DELIVERED";

export interface ShippingAddress {
  street: string;
  city: string;
  postcode: string;
  countryCode: string;
  phone: string;
  email: string;
  company?: string | null;
  name?: string | null;
  surname?: string | null;
}

export interface OrderItem {
  sku: Sku;
  quantity: number;
  unitPrice: Money;
  name?: string;
}

export interface OrderMirror {
  id: OrderId;
  shopId: ShopId;
  /** cartId from Furgonetka inbound, used for EXTORDER idempotency */
  externalOrderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  items: OrderItem[];
  total: Money;
  createdAt: Date;
  shippingAddress: ShippingAddress;
  codAmount: Money;
  totalPaid: Money;
  trackingNumber?: string;
  courierService?: string;
  pickupPoint?: string;
  comment?: string;
}

export interface CreateOrderCommand {
  shopId: ShopId;
  cartId?: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  codAmount?: Money;
  datetimeOrder?: string;
  service?: string;
  pickupPoint?: string;
  comment?: string;
}

export interface ApplyPaymentCommand {
  shopId: ShopId;
  orderId: OrderId;
  paymentStatus: PaymentStatus;
  paidAmount?: Money;
}

export interface ApplyTrackingCommand {
  shopId: ShopId;
  orderId: OrderId;
  trackingNumber: string;
  courierService: string;
}
