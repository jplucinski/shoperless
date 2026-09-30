import type { Product } from "@liteshop/core";
import { descriptionFor, titleFor } from "./product-photos.ts";

function meta(product: Product, key: string): string {
  return product.metadata?.[key]?.trim() ?? "";
}

export function seoTitleFor(product: Product): string {
  return meta(product, "seoTitle") || titleFor(product);
}

export function seoDescriptionFor(product: Product): string {
  return meta(product, "seoDescription") || descriptionFor(product);
}

export function altTextFor(product: Product): string {
  return meta(product, "altText") || titleFor(product);
}

export function plnDecimal(grosze: number): string {
  const whole = Math.trunc(grosze / 100);
  const frac = String(Math.abs(grosze % 100)).padStart(2, "0");
  return `${whole}.${frac}`;
}

export function absoluteAssetUrl(origin: string, src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return new URL(src, origin).href;
}

export function productJsonLd(input: {
  product: Product;
  pageUrl: string;
  images: string[];
}): Record<string, unknown> {
  const description = descriptionFor(input.product) || seoDescriptionFor(input.product);
  const doc: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: titleFor(input.product),
    sku: input.product.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "PLN",
      price: plnDecimal(input.product.price),
      availability: "https://schema.org/InStock",
      url: input.pageUrl,
    },
  };
  if (description) doc.description = description;
  if (input.images.length > 0) doc.image = input.images;
  return doc;
}

export function jsonLdPayload(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
