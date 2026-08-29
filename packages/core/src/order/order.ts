import type { OrderId, ShopId, Sku } from "../ids.ts";
import type { Money } from "../money.ts";
import type { CartItem } from "../cart/cart.ts";

export type OrderStatus = "CREATED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type ShippingStatus = "NOT_SHIPPED" | "IN_TRANSIT" | "DELIVERED";

export interface OrderItem {
  sku: Sku;
  quantity: number;
  unitPrice: Money;
}

export interface OrderMirror {
  id: OrderId;
  shopId: ShopId;
  externalOrderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  items: OrderItem[];
  total: Money;
}

export interface CreateOrderCommand {
  shopId: ShopId;
  externalOrderId: string;
  items: CartItem[];
}

export interface ApplyPaymentCommand {
  shopId: ShopId;
  externalOrderId: string;
  paymentStatus: PaymentStatus;
}
