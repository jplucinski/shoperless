import type { ShopId } from "../ids.ts";

export interface FurgonetkaConnection {
  shopId: ShopId;
  accountId: string;
  refreshTokenCiphertext: string;
  connectedAt: Date;
  status: "connected" | "disconnected";
}
