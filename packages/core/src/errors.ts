export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class DuplicateSkuError extends DomainError {
  constructor(sku: string) {
    super("DUPLICATE_SKU", `sku already exists: ${sku}`);
    this.name = "DuplicateSkuError";
  }
}

export class DuplicateSlugError extends DomainError {
  constructor(slug: string) {
    super("DUPLICATE_SLUG", `slug already exists: ${slug}`);
    this.name = "DuplicateSlugError";
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(slug: string) {
    super("PRODUCT_NOT_FOUND", `product not found: ${slug}`);
    this.name = "ProductNotFoundError";
  }
}

export class ProductInactiveError extends DomainError {
  constructor(slug: string) {
    super("PRODUCT_INACTIVE", `product is inactive: ${slug}`);
    this.name = "ProductInactiveError";
  }
}

export class InsufficientStockError extends DomainError {
  constructor(sku: string, quantity: number) {
    super("INSUFFICIENT_STOCK", `insufficient stock for ${sku} (requested ${quantity})`);
    this.name = "InsufficientStockError";
  }
}
