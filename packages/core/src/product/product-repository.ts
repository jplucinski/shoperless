import type { ProductId, ShopId, Sku } from "../ids.ts";
import type { Product } from "./product.ts";

export interface ProductRepository {
  getById(shopId: ShopId, productId: ProductId): Promise<Product | undefined>;
  getBySku(shopId: ShopId, sku: Sku): Promise<Product | undefined>;
  getBySlug(shopId: ShopId, slug: string): Promise<Product | undefined>;
  list(shopId: ShopId): Promise<Product[]>;
  save(product: Product): Promise<void>;
}
