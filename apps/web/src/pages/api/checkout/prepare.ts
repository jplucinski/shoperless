import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import { toCheckoutCartData } from "@liteshop/furgonetka";
import { z } from "zod";
import { createServices } from "../../lib/core.ts";
import { toHttpError } from "../../lib/http.ts";

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
    const { cart, logger } = createServices();
    const prepared = await cart.prepare(SEED_SHOP_ID, items);
    logger.info({
      shopId: SEED_SHOP_ID,
      operation: "checkout.prepare",
      correlationId: crypto.randomUUID(),
    });
    return new Response(JSON.stringify(toCheckoutCartData(prepared)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ code: "INVALID_CART", message: "invalid items" }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    }
    const mapped = toHttpError(error);
    return new Response(JSON.stringify(mapped.body), {
      status: mapped.status,
      headers: { "content-type": "application/json" },
    });
  }
};
