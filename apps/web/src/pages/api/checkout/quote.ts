import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import { z } from "zod";
import { createServices } from "../../../lib/core.ts";
import { toHttpError } from "../../../lib/http.ts";

const bodySchema = z.object({
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const json: unknown = await request.json();
    const { items } = bodySchema.parse(json);
    const { cart } = createServices();
    const prepared = await cart.prepare(SEED_SHOP_ID, items);
    const lines = prepared.lines.map((line) => ({
      sku: line.sku,
      name: line.name,
      unitPrice: line.unitPrice,
    }));
    return new Response(JSON.stringify({ lines }), {
      status: 200,
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
