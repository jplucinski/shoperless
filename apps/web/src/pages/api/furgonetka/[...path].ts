import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";
import {
  INBOUND_ORDER_PATH,
  INBOUND_PAYMENT_PATH,
  SHARED_KEY_HEADER,
  inboundOrderResponse,
  inboundPaymentResponse,
  parseInboundOrder,
  parseInboundPayment,
  verifySharedKey,
} from "@liteshop/furgonetka";
import { Resource } from "sst";
import { createServices } from "../../../lib/core.ts";

export const POST: APIRoute = async ({ params, request }) => {
  const raw = params.path;
  const path = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  const key = request.headers.get(SHARED_KEY_HEADER);
  if (!verifySharedKey(key, Resource.KoszykSharedKey.value)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const { orders, logger } = createServices();
  const correlationId = crypto.randomUUID();
  logger.info({
    shopId: SEED_SHOP_ID,
    operation: "furgonetka.inbound",
    correlationId,
  });
  const body: unknown = await request.json();
  if (path === INBOUND_ORDER_PATH) {
    const cmd = parseInboundOrder(body, SEED_SHOP_ID);
    const result = await orders.createFromExternal(cmd);
    return new Response(JSON.stringify(inboundOrderResponse(result.order.externalOrderId)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (path === INBOUND_PAYMENT_PATH) {
    const cmd = parseInboundPayment(body, SEED_SHOP_ID);
    await orders.applyPayment(cmd);
    return new Response(JSON.stringify(inboundPaymentResponse(cmd.externalOrderId)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
};
