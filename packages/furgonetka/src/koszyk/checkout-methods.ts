import {
  PaymentMethodProviders,
  type CheckoutPaymentMethod,
  type CheckoutShippingMethod,
} from "./checkout-cart-data.ts";

export const SEED_PAYMENT_METHOD_ID = "pay-tpay";
export const SEED_SHIPPING_METHOD_ID = "ship-courier";

export function seedPaymentMethods(): CheckoutPaymentMethod[] {
  return [
    {
      id: SEED_PAYMENT_METHOD_ID,
      name: "Płatność online",
      type: "payByLink",
      provider: PaymentMethodProviders.Tpay,
    },
  ];
}

export function seedShippingMethods(): CheckoutShippingMethod[] {
  return [
    {
      id: SEED_SHIPPING_METHOD_ID,
      name: "Kurier",
      priceGross: 15.99,
      deliveryType: "courier",
      paymentMethods: [{ id: SEED_PAYMENT_METHOD_ID }],
    },
  ];
}
