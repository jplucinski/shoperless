import type { ShopId, Sku } from "../ids.ts";
import type { Money } from "../money.ts";

export interface CartItem {
  sku: Sku;
  quantity: number;
}

export interface PreparedLine {
  sku: Sku;
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface PreparedCheckout {
  shopId: ShopId;
  currency: "PLN";
  lines: PreparedLine[];
  total: Money;
}
