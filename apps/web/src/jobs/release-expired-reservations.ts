import { SEED_SHOP_ID } from "@liteshop/core";
import { createServices } from "../lib/core.ts";


export async function handler() {
  const { orders, logger } = createServices();
  const released = await orders.releaseExpiredReservations(SEED_SHOP_ID);
  logger.info({
    shopId: SEED_SHOP_ID,
    operation: "reservation.release",
    correlationId: crypto.randomUUID(),
  });
  return { released };
}
