import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import {
  AUTH_HEADER,
  parseAddOrder,
  parseAddPayment,
  parseFurgonetkaRoute,
  parseTrackingNumber,
  toOrderOut,
  verifySharedKey,
} from "@liteshop/furgonetka";
import { Resource } from "sst";
import { z } from "zod";
import { createServices } from "../../../lib/core.ts";
import { toHttpError } from "../../../lib/http.ts";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized() {
  return json({ error: "unauthorized" }, 401);
}

function notFound() {
  return json({ error: "not_found" }, 404);
}

function mapInboundError(error: unknown) {
  if (error instanceof z.ZodError) {
    return json({ error: "invalid_body" }, 400);
  }
  const mapped = toHttpError(error);
  if (mapped.status === 404) {
    return notFound();
  }
  return json(mapped.body, mapped.status);
}

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? "100");
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.trunc(n), 100);
}

export const GET: APIRoute = async ({ params, request }) => {
  const raw = params.path;
  const path = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const key = request.headers.get(AUTH_HEADER);
  if (!verifySharedKey(key, Resource.KoszykSharedKey.value)) {
    return unauthorized();
  }
  const route = parseFurgonetkaRoute(path);
  if (route?.kind !== "orders-collection") {
    return notFound();
  }
  const url = new URL(request.url);
  const datetime = url.searchParams.get("datetime") ?? undefined;
  const { orders } = createServices();
  const listed = await orders.listSince(SEED_SHOP_ID, datetime, parseLimit(url.searchParams.get("limit")));
  return json(listed.map(toOrderOut), 200);
};

export const POST: APIRoute = async ({ params, request }) => {
  const raw = params.path;
  const path = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const key = request.headers.get(AUTH_HEADER);
  if (!verifySharedKey(key, Resource.KoszykSharedKey.value)) {
    return unauthorized();
  }
  const route = parseFurgonetkaRoute(path);
  if (!route) {
    return notFound();
  }
  const { orders, logger } = createServices();
  const correlationId = crypto.randomUUID();
  logger.info({
    shopId: SEED_SHOP_ID,
    operation: "furgonetka.inbound",
    correlationId,
  });
  try {
    const body: unknown = await request.json();
    if (route.kind === "orders-collection") {
      const cmd = parseAddOrder(body, SEED_SHOP_ID);
      const result = await orders.createFromExternal(cmd);
      return json(toOrderOut(result.order), 200);
    }
    if (route.kind === "orders-payments") {
      const cmd = parseAddPayment(body, SEED_SHOP_ID, route.sourceOrderId);
      await orders.applyPayment(cmd);
      return new Response(null, { status: 200 });
    }
    if (route.kind === "orders-tracking") {
      const cmd = parseTrackingNumber(body, SEED_SHOP_ID, route.sourceOrderId);
      await orders.applyTracking(cmd);
      return new Response(null, { status: 200 });
    }
    return notFound();
  } catch (error) {
    return mapInboundError(error);
  }
};
