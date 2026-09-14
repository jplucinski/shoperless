import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import { AUTH_HEADER, handleFurgonetkaInbound } from "@liteshop/furgonetka";
import { Resource } from "sst";
import { createServices } from "../../../lib/core.ts";

function json(body: unknown, status: number) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: body === null ? undefined : { "content-type": "application/json" },
  });
}

async function inbound(method: "GET" | "POST", params: { path?: string | string[] }, request: Request) {
  const raw = params.path;
  const path = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const url = new URL(request.url);
  const { orders, logger } = createServices();
  if (method === "POST") {
    logger.info({
      shopId: SEED_SHOP_ID,
      operation: "furgonetka.inbound",
      correlationId: crypto.randomUUID(),
    });
  }
  let body: unknown = null;
  if (method === "POST") {
    body = await request.json();
  }
  const result = await handleFurgonetkaInbound({
    method,
    path,
    authHeader: request.headers.get(AUTH_HEADER),
    expectedKey: Resource.KoszykSharedKey.value,
    shopId: SEED_SHOP_ID,
    body,
    datetime: url.searchParams.get("datetime") ?? undefined,
    limit: url.searchParams.get("limit"),
    orders,
  });
  return json(result.body, result.status);
}

export const GET: APIRoute = async ({ params, request }) => inbound("GET", params, request);

export const POST: APIRoute = async ({ params, request }) => inbound("POST", params, request);
