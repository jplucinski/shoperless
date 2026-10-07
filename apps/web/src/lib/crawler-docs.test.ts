import { SEED_SHOP_ID, type Product } from "@liteshop/core";
import { describe, expect, it } from "vitest";
import { llmsTxt, robotsTxt } from "./crawler-docs.ts";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_1",
    shopId: SEED_SHOP_ID,
    sku: "TOWEL-BLUE",
    slug: "blue-towel",
    name: "Niebieskie pole",
    description: "Obraz. Jeden egzemplarz.",
    images: [],
    price: 19900,
    status: "active",
    metadata: {},
    ...overrides,
  };
}

describe("robotsTxt", () => {
  it("opens the storefront and keeps admin, api, and cart out", () => {
    const text = robotsTxt("https://shop.example");
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Disallow: /api");
    expect(text).toContain("Disallow: /cart");
    expect(text).toContain("# llms.txt: https://shop.example/llms.txt");
    expect(text.match(/User-agent:/g)).toHaveLength(1);
  });
});

describe("llmsTxt", () => {
  it("lists shop pages and active works with absolute urls", () => {
    const text = llmsTxt("https://shop.example", [product()]);
    expect(text.startsWith("# LiteShop\n")).toBe(true);
    expect(text).toContain("> Pracownia obrazu i rysunku.");
    expect(text).toContain("[Prace](https://shop.example/prace)");
    expect(text).toContain(
      "[Niebieskie pole](https://shop.example/products/blue-towel): Obraz. Jeden egzemplarz.",
    );
  });

  it("says the catalog is empty when nothing is active", () => {
    expect(llmsTxt("https://shop.example/", [])).toContain("Katalog jest pusty.");
  });
});
