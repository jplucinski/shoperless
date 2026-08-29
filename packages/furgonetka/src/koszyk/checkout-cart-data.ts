/**
 * Fallback CheckoutCartData / CheckoutInitConfiguration until Koszyk docs
 * TypeScript is captured verbatim. Money is złoty (not grosze).
 */

export interface CheckoutCartProduct {
  name: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface CheckoutCartData {
  products: CheckoutCartProduct[];
  totalPrice: number;
}

export interface CheckoutInitConfiguration {
  dataProviderCallback: () => Promise<CheckoutCartData>;
  addProductToCartButtonContainer?: string;
  addProductToCartCallback?: (event: unknown) => Promise<boolean>;
  eventsCallback?: (event: { type: string; payload: unknown }) => void;
}
