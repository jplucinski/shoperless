import type { APIRoute } from "astro";
import { z } from "zod";
import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../../../lib/core.ts";
import { toHttpError } from "../../../lib/http.ts";
import { parsePriceGrosze } from "../../../lib/price.ts";

const createSchema = z.object({
  action: z.literal("create"),
  sku: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceZloty: z.string().min(1),
});

const statusSchema = z.object({
  action: z.literal("setStatus"),
  sku: z.string().min(1),
  status: z.enum(["active", "inactive"]),
});

const bodySchema = z.discriminatedUnion("action", [createSchema, statusSchema]);

export const POST: APIRoute = async ({ request }) => {
  try {
    const json: unknown = await request.json();
    const body = bodySchema.parse(json);
    const { products } = createServices();
    if (body.action === "setStatus") {
      await products.setStatus(SEED_SHOP_ID, body.sku, body.status);
    } else {
      await products.create({
        shopId: SEED_SHOP_ID,
        sku: body.sku,
        slug: body.slug,
        name: body.name,
        description: body.description,
        images: [],
        price: parsePriceGrosze(body.priceZloty),
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const mapped = toHttpError(error);
    return new Response(JSON.stringify(mapped.body), {
      status: mapped.status,
      headers: { "content-type": "application/json" },
    });
  }
};
