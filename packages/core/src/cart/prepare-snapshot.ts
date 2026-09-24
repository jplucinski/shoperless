import type { ShopId } from "../ids.ts";
import type { Money } from "../money.ts";
import type { PreparedLine } from "./cart.ts";

export const DEFAULT_PREPARE_TTL_MS = 30 * 60 * 1000;

export interface PreparedCheckoutSnapshot {
  shopId: ShopId;
  prepareId: string;
  lines: PreparedLine[];
  total: Money;
  currency: "PLN";
  expiresAt: Date;
}
