import type { APIRoute } from "astro";
import { z } from "zod";
import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../../../lib/core.ts";
import { toHttpError } from "../../../lib/http.ts";
import { adminSecret, isAdminSession, SESSION_COOKIE } from "../../../lib/session.ts";

const createSchema = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceZloty: z.number().positive(),
});

const statusSchema = z.object({
  sku: z.string().min(1),
  status: z.enum(["active", "inactive"]),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminSession(cookies.get(SESSION_COOKIE)?.value, adminSecret())) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const json: unknown = await request.json();
    const { products } = createServices();
    if (typeof json === "object" && json !== null && "status" in json) {
      const body = statusSchema.parse(json);
      await products.setStatus(SEED_SHOP_ID, body.sku, body.status);
    } else {
      const body = createSchema.parse(json);
      await products.create({
        shopId: SEED_SHOP_ID,
        sku: body.sku,
        slug: body.slug,
        name: body.name,
        description: body.description,
        images: [],
        price: Math.round(body.priceZloty * 100),
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
