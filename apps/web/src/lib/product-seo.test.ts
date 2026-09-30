import { SEED_SHOP_ID, type Product } from "@liteshop/core";
import { describe, expect, it } from "vitest";
import { pdpDetails } from "./product-photos.ts";
import {
  absoluteAssetUrl,
  altTextFor,
  jsonLdPayload,
  plnDecimal,
  productJsonLd,
  seoDescriptionFor,
  seoTitleFor,
} from "./product-seo.ts";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_1",
    shopId: SEED_SHOP_ID,
    sku: "TOWEL-BLUE",
    slug: "blue-towel",
    name: "Niebieskie pole",
    description: "Obraz. Jeden egzemplarz.",
    images: ["/works/cobalt.png"],
    price: 19900,
    status: "active",
    metadata: {},
    ...overrides,
  };
}

describe("product seo copy", () => {
  it("prefers generated title, description, and alt", () => {
    const item = product({
      metadata: {
        seoTitle: "Niebieskie pole — obraz",
        seoDescription: "Jedyny egzemplarz obrazu.",
        altText: "Niebieskie pole na płótnie",
      },
    });
    expect(seoTitleFor(item)).toBe("Niebieskie pole — obraz");
    expect(seoDescriptionFor(item)).toBe("Jedyny egzemplarz obrazu.");
    expect(altTextFor(item)).toBe("Niebieskie pole na płótnie");
  });

  it("falls back when generated copy is missing or blank", () => {
    const item = product({
      metadata: { seoTitle: "  ", seoDescription: "", altText: " " },
    });
    expect(seoTitleFor(item)).toBe("Niebieskie pole");
    expect(seoDescriptionFor(item)).toBe("Obraz. Jeden egzemplarz.");
    expect(altTextFor(item)).toBe("Niebieskie pole");
  });
});

describe("pdpDetails", () => {
  it("keeps seo keys off the visible sheet", () => {
    const rows = pdpDetails(
      product({
        metadata: {
          artist: "Lena Wrzesień",
          medium: "Obraz",
          seoTitle: "Tytuł SEO",
          seoDescription: "Opis SEO",
          altText: "Alt",
          year: "2024",
        },
      }),
    );
    expect(rows.map((row) => row.label)).toEqual(["Artysta", "Medium", "Egzemplarz", "year"]);
  });
});

describe("productJsonLd", () => {
  it("builds an offer from grosze, the visible name, and the page url", () => {
    const doc = productJsonLd({
      product: product({
        metadata: { seoDescription: "Opis tylko do meta." },
      }),
      pageUrl: "https://shop.example/products/blue-towel",
      images: ["https://shop.example/works/cobalt.png"],
    });
    expect(doc).toMatchObject({
      "@type": "Product",
      name: "Niebieskie pole",
      description: "Obraz. Jeden egzemplarz.",
      sku: "TOWEL-BLUE",
      image: ["https://shop.example/works/cobalt.png"],
      offers: {
        "@type": "Offer",
        priceCurrency: "PLN",
        price: "199.00",
        availability: "https://schema.org/InStock",
        url: "https://shop.example/products/blue-towel",
      },
    });
  });

  it("omits an empty description", () => {
    const doc = productJsonLd({
      product: product({ description: "  ", slug: "unknown-work" }),
      pageUrl: "https://shop.example/products/unknown-work",
      images: [],
    });
    expect(doc).not.toHaveProperty("description");
    expect(doc).not.toHaveProperty("image");
  });
});

describe("seo helpers", () => {
  it("formats grosze as a decimal price", () => {
    expect(plnDecimal(19900)).toBe("199.00");
    expect(plnDecimal(5)).toBe("0.05");
  });

  it("resolves relative assets against the shop origin", () => {
    expect(absoluteAssetUrl("https://shop.example", "/works/cobalt.png")).toBe(
      "https://shop.example/works/cobalt.png",
    );
    expect(absoluteAssetUrl("https://shop.example", "https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
  });

  it("escapes angle brackets in json-ld", () => {
    expect(jsonLdPayload({ name: "</script><script>" })).toBe(
      '{"name":"\\u003c/script>\\u003cscript>"}',
    );
  });
});
