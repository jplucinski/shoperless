import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../../../lib/core.ts";

export const POST: APIRoute = async () => {
  if (!import.meta.env.DEV) {
    return new Response("Not found", { status: 404 });
  }
  const { products, stock } = createServices();
  const existing = await products.listActive(SEED_SHOP_ID);
  if (!existing.some((p) => p.sku === "TOWEL-BLUE")) {
    await products.create({
      shopId: SEED_SHOP_ID,
      sku: "TOWEL-BLUE",
      slug: "blue-towel",
      name: "Blue Towel",
      description: "Soft",
      images: [],
      price: 19900,
    });
    await stock.applyDelivery(SEED_SHOP_ID, "TOWEL-BLUE", 10);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};
