import type { ProductId, ShopId, Sku } from "../ids.ts";
import type { Product } from "./product.ts";
import type { ProductRepository } from "./product-repository.ts";

function key(shopId: ShopId, id: string): string {
  return `${shopId}#${id}`;
}

export class MemoryProductRepository implements ProductRepository {
  private readonly byId = new Map<string, Product>();

  async getById(shopId: ShopId, productId: ProductId) {
    return this.byId.get(key(shopId, productId));
  }
  async getBySku(shopId: ShopId, sku: Sku) {
    return [...this.byId.values()].find(
      (p) => p.shopId === shopId && p.sku === sku,
    );
  }
  async getBySlug(shopId: ShopId, slug: string) {
    return [...this.byId.values()].find(
      (p) => p.shopId === shopId && p.slug === slug,
    );
  }
  async list(shopId: ShopId) {
    return [...this.byId.values()].filter((p) => p.shopId === shopId);
  }
  async save(product: Product) {
    this.byId.set(key(product.shopId, product.id), product);
  }
}
