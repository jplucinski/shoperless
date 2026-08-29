import type { ProductId, ShopId, Sku } from "../ids.ts";
import type { Money } from "../money.ts";

export type ProductStatus = "active" | "inactive";

export interface Product {
  id: ProductId;
  shopId: ShopId;
  sku: Sku;
  slug: string;
  name: string;
  description: string;
  images: string[];
  price: Money;
  status: ProductStatus;
  metadata: Record<string, string>;
}
