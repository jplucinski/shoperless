import type { Product } from "@liteshop/core";
import { studioWork } from "./studio-works.ts";

export function photosFor(product: Product): string[] {
  const fromProduct = product.images.filter((src) => typeof src === "string" && src.trim().length > 0);
  const fromStudio = studioWork(product.slug)?.images ?? [];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const src of [...fromProduct, ...fromStudio]) {
    if (seen.has(src)) continue;
    seen.add(src);
    merged.push(src);
  }
  return merged;
}

export function titleFor(product: Product): string {
  const fromProduct = product.name?.trim();
  if (fromProduct) return fromProduct;
  return studioWork(product.slug)?.name ?? product.sku;
}

export function descriptionFor(product: Product): string {
  const fromProduct = product.description?.trim();
  if (fromProduct) return fromProduct;
  return studioWork(product.slug)?.description ?? "";
}

export function artistFor(product: Product): string | undefined {
  const fromMeta = product.metadata?.artist;
  if (fromMeta) return fromMeta;
  return studioWork(product.slug)?.artist;
}

export function mediumFor(product: Product): string | undefined {
  const fromMeta = product.metadata?.medium;
  if (fromMeta) return fromMeta;
  return studioWork(product.slug)?.medium;
}

export interface PdpDetailRow {
  label: string;
  value: string;
}

const METADATA_LABELS: Record<string, string> = {
  medium: "Medium",
};

const HIDDEN_METADATA = new Set(["artist", "medium", "seoTitle", "seoDescription", "altText"]);

export function pdpDetails(product: Product): PdpDetailRow[] {
  const rows: PdpDetailRow[] = [];
  const artist = artistFor(product);
  if (artist) rows.push({ label: "Artysta", value: artist });
  const medium = mediumFor(product);
  if (medium) rows.push({ label: "Medium", value: medium });
  rows.push({ label: "Egzemplarz", value: "Jeden" });
  for (const [key, value] of Object.entries(product.metadata ?? {})) {
    if (HIDDEN_METADATA.has(key) || !value.trim()) continue;
    const label = METADATA_LABELS[key] ?? key;
    rows.push({ label, value: value.trim() });
  }
  return rows;
}

export function descriptionParagraphs(description: string): string[] {
  if (!description.trim()) return [];
  return description
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
