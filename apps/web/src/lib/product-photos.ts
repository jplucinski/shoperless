import type { Product } from "@liteshop/core";
import { studioWork, STUDIO_WORKS } from "./studio-works.ts";

export function photosFor(product: Product): string[] {
  if (product.images.length > 0) return product.images;
  return studioWork(product.slug)?.images
    ? [...studioWork(product.slug)!.images]
    : [...STUDIO_WORKS[0].images];
}

export function titleFor(product: Product): string {
  return studioWork(product.slug)?.name ?? (product.name?.trim() || product.sku);
}

export function descriptionFor(product: Product): string {
  return studioWork(product.slug)?.description ?? (product.description?.trim() || "");
}

export function artistFor(product: Product): string | undefined {
  const fromMeta = product.metadata?.artist;
  if (fromMeta) return fromMeta;
  return studioWork(product.slug)?.artist;
}
