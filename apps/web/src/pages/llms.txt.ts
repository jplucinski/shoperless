import { SEED_SHOP_ID, type Product } from "@liteshop/core";
import type { APIRoute } from "astro";
import { llmsTxt } from "../lib/crawler-docs.ts";
import { createServices } from "../lib/core.ts";
import { DEV_PREVIEW_PRODUCTS } from "../lib/dev-preview-product.ts";

export const GET: APIRoute = async ({ url }) => {
  let products: Product[] = [];
  try {
    const { products: catalog } = createServices();
    products = await catalog.listActive(SEED_SHOP_ID);
  } catch {
    if (import.meta.env.DEV) products = [...DEV_PREVIEW_PRODUCTS];
  }
  return new Response(llmsTxt(url.origin, products), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
