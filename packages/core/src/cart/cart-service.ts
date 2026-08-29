import { DomainError, InsufficientStockError, ProductInactiveError, ProductNotFoundError } from "../errors.ts";
import type { ShopId } from "../ids.ts";
import { available } from "../inventory/inventory.ts";
import type { InventoryRepository } from "../inventory/inventory-repository.ts";
import type { ProductRepository } from "../product/product-repository.ts";
import type { CartItem, PreparedCheckout, PreparedLine } from "./cart.ts";

export class CartService {
  constructor(
    private readonly deps: {
      products: ProductRepository;
      inventory: InventoryRepository;
    },
  ) {}

  async prepare(shopId: ShopId, items: CartItem[]): Promise<PreparedCheckout> {
    const lines: PreparedLine[] = [];
    let total = 0;
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new DomainError("INVALID_CART", "quantity must be a positive integer");
      }
      const product = await this.deps.products.getBySku(shopId, item.sku);
      if (!product) {
        throw new ProductNotFoundError(item.sku);
      }
      if (product.status !== "active") {
        throw new ProductInactiveError(item.sku);
      }
      const inv = await this.deps.inventory.get(shopId, item.sku);
      const stock = inv ?? { shopId, sku: item.sku, onHand: 0, reserved: 0 };
      if (available(stock) < item.quantity) {
        throw new InsufficientStockError(item.sku, item.quantity);
      }
      const lineTotal = product.price * item.quantity;
      lines.push({
        sku: item.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal,
      });
      total += lineTotal;
    }
    return { shopId, currency: "PLN", lines, total };
  }
}
