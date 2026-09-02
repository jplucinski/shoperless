import type { APIRoute } from "astro";
import { z } from "zod";
import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../../../lib/core.ts";
import { adminSecret, isAdminSession, SESSION_COOKIE } from "../../../lib/session.ts";

const bodySchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int(),
  reason: z.enum(["DELIVERY", "ADJUSTMENT"]),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminSession(cookies.get(SESSION_COOKIE)?.value, adminSecret())) {
    return new Response("Unauthorized", { status: 401 });
  }
  const json: unknown = await request.json();
  const body = bodySchema.parse(json);
  const { stock } = createServices();
  if (body.reason === "DELIVERY") {
    await stock.applyDelivery(SEED_SHOP_ID, body.sku, body.quantity);
  } else {
    await stock.applyAdjustment(SEED_SHOP_ID, body.sku, body.quantity);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};
