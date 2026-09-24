import type { APIRoute } from "astro";
import { DEFAULT_PREPARE_TTL_MS, SEED_SHOP_ID } from "@liteshop/core";
import { toCheckoutCartData } from "@liteshop/furgonetka";
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
    const { cart, snapshots, ids, clock, logger } = createServices();
    const prepared = await cart.prepare(SEED_SHOP_ID, items);
    const prepareId = ids.prepareId();
    const expiresAt = new Date(clock.now().getTime() + DEFAULT_PREPARE_TTL_MS);
    await snapshots.save({
      shopId: SEED_SHOP_ID,
      prepareId,
      lines: prepared.lines,
      total: prepared.total,
      currency: prepared.currency,
      expiresAt,
    });
    logger.info({
      shopId: SEED_SHOP_ID,
      operation: "checkout.prepare",
      externalOrderId: prepareId,
      correlationId: crypto.randomUUID(),
    });
    return new Response(JSON.stringify(toCheckoutCartData(prepared, prepareId)), {
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
