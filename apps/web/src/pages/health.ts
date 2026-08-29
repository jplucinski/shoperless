import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: true, shopId: SEED_SHOP_ID }), {
    headers: { "content-type": "application/json" },
  });
