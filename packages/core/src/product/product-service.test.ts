import { describe, expect, it } from "vitest";
import { UlidGenerator } from "../ids.ts";
import { MemoryProductRepository } from "./memory-product-repository.ts";
import { ProductService } from "./product-service.ts";

const shopId = "shop_seed";

function service() {
  return new ProductService({
    products: new MemoryProductRepository(),
    ids: new UlidGenerator(),
  });
}

describe("ProductService", () => {
  it("creates a product and lists it when active", async () => {
    const products = service();
    const created = await products.create({
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "Soft",
      images: ["https://img.example/t.jpg"],
      price: 19900,
    });
    expect(created.price).toBe(19900);
    expect(created.status).toBe("active");
    const listed = await products.listActive(shopId);
    expect(listed.map((p) => p.sku)).toEqual(["TOWEL-BLUE"]);
  });

  it("rejects duplicate sku in the same shop", async () => {
    const products = service();
    const input = {
      shopId,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "",
      images: [],
      price: 100,
    };
    await products.create(input);
    await expect(
      products.create({ ...input, slug: "other" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_SKU" });
  });

  it("does not list inactive products on the storefront", async () => {
    const products = service();
    await products.create({
      shopId,
      sku: "HIDDEN",
      slug: "hidden",
      name: "Hidden",
      description: "",
      images: [],
      price: 100,
      status: "inactive",
    });
    await expect(products.listActive(shopId)).resolves.toEqual([]);
    await expect(products.getActiveBySlug(shopId, "hidden")).rejects.toMatchObject({
      code: "PRODUCT_INACTIVE",
    });
  });
});
