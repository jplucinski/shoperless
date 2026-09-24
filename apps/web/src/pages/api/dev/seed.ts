import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../../../lib/core.ts";
import { STUDIO_WORKS } from "../../../lib/studio-works.ts";

export const POST: APIRoute = async () => {
  if (!import.meta.env.DEV) {
    return new Response("Not found", { status: 404 });
  }
  const { products, stock } = createServices();
  const existing = await products.listActive(SEED_SHOP_ID);
  for (const work of STUDIO_WORKS) {
    const listing = {
      name: work.name,
      description: work.description,
      images: [...work.images],
    };
    if (!existing.some((product) => product.sku === work.sku)) {
      await products.create({
        shopId: SEED_SHOP_ID,
        sku: work.sku,
        slug: work.slug,
        price: work.price,
        ...listing,
      });
      await stock.applyDelivery(SEED_SHOP_ID, work.sku, 10);
    } else {
      await products.reviseListing(SEED_SHOP_ID, work.sku, listing);
    }
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};
