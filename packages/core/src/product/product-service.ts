import {
  DuplicateSkuError,
  DuplicateSlugError,
  ProductInactiveError,
  ProductNotFoundError,
} from "../errors.ts";
import type { IdGenerator, ShopId } from "../ids.ts";
import { assertMoney, type Money } from "../money.ts";
import type { Product, ProductStatus } from "./product.ts";
import type { ProductRepository } from "./product-repository.ts";

export class ProductService {
  constructor(
    private readonly deps: { products: ProductRepository; ids: IdGenerator },
  ) {}

  async create(input: {
    shopId: ShopId;
    sku: string;
    slug: string;
    name: string;
    description: string;
    images: string[];
    price: Money;
    status?: ProductStatus;
  }): Promise<Product> {
    assertMoney(input.price);
    if (await this.deps.products.getBySku(input.shopId, input.sku)) {
      throw new DuplicateSkuError(input.sku);
    }
    if (await this.deps.products.getBySlug(input.shopId, input.slug)) {
      throw new DuplicateSlugError(input.slug);
    }
    const product: Product = {
      id: this.deps.ids.productId(),
      shopId: input.shopId,
      sku: input.sku,
      slug: input.slug,
      name: input.name,
      description: input.description,
      images: input.images,
      price: input.price,
      status: input.status ?? "active",
      metadata: {},
    };
    await this.deps.products.save(product);
    return product;
  }

  async listActive(shopId: ShopId): Promise<Product[]> {
    const all = await this.deps.products.list(shopId);
    return all.filter((p) => p.status === "active");
  }

  async getActiveBySlug(shopId: ShopId, slug: string): Promise<Product> {
    const product = await this.deps.products.getBySlug(shopId, slug);
    if (!product) {
      throw new ProductNotFoundError(slug);
    }
    if (product.status !== "active") {
      throw new ProductInactiveError(slug);
    }
    return product;
  }
}
