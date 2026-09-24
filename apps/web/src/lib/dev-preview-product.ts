import { SEED_SHOP_ID, type Product } from "@liteshop/core";
import { STUDIO_WORKS } from "./studio-works.ts";

export const DEV_PREVIEW_PRODUCTS: Product[] = STUDIO_WORKS.map((work) => ({
  id: `prd_preview_${work.slug}`,
  shopId: SEED_SHOP_ID,
  sku: work.sku,
  slug: work.slug,
  name: work.name,
  description: work.description,
  images: [...work.images],
  price: work.price,
  status: "active",
  metadata: { artist: work.artist },
}));

export const DEV_PREVIEW_PRODUCT = DEV_PREVIEW_PRODUCTS[0]!;
