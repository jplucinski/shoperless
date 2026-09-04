/**
 * Copied from https://furgonetka.pl/js/dist/checkout/universal-checkout.d.ts
 * Money fields are złoty (not grosze).
 */

export enum EventType {
  orderCreated = "ORDER_CREATED",
  viewOrderSummary = "VIEW_ORDER_SUMMARY",
}

export interface EventsCallbackParams {
  type: EventType;
  payload?: OrderCreatedEventPayload | ViewOrderSummaryEventPayload;
}

export interface OrderEventPayload {
  orderId?: string;
}

export type OrderCreatedEventPayload = OrderEventPayload;
export type ViewOrderSummaryEventPayload = OrderEventPayload;

export interface CheckoutCartData {
  cart: CheckoutCart;
  shippingMethods: CheckoutShippingMethod[];
  paymentMethods: CheckoutPaymentMethod[];
}

export interface CheckoutInitConfiguration {
  checkoutUuid: string;
  defaultButtonContainer: string;
  addProductToCartButtonContainer?: string;
  addProductToCartCallback?: (event: Event) => Promise<boolean>;
  dataProviderCallback: () => Promise<CheckoutCartData>;
  eventsCallback?: (params: EventsCallbackParams) => void;
}

export interface CheckoutCart {
  id?: string | null;
  currency?: string;
  discount?: number;
  discountInfo?: string;
  products: CheckoutCartProduct[];
  totalGross: number;
}

export interface CheckoutCartProduct {
  id: string;
  stockId?: string | null;
  name: string;
  quantity: number;
  unit?: string | null;
  priceGross: number;
  imageUrl?: string | null;
  attributes?: CheckoutCartProductAttribute[];
}

export interface CheckoutCartProductAttribute {
  name: string;
  value: string;
  id?: string | null;
  valueId?: string | null;
}

export interface CheckoutPaymentMethod {
  id: string;
  name: string;
  type: "cod" | "payByLink";
  provider?: PaymentMethodProviders | null;
}

export enum PaymentMethodProviders {
  Przelewy24 = "przelewy24",
  Payu = "payu",
  Tpay = "tpay",
}

export interface CheckoutShippingMethod {
  id: string;
  name: string;
  priceGross: number;
  deliveryType: "point" | "parcel_locker" | "self_pickup" | "courier";
  deliveryService?: ShippingMethodDeliveryServices | null;
  paymentMethods: CheckoutShippingPaymentMethod[];
}

export enum ShippingMethodDeliveryServices {
  Inpost = "inpost",
  Orlen = "orlen",
  Ups = "ups",
  Dpd = "dpd",
  Poczta = "poczta",
  Dhl = "dhl",
  Fedex = "fedex",
}

export interface CheckoutShippingPaymentMethod {
  id: string;
  surcharge?: number;
}
