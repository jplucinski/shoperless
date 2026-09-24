import type { ShopId } from "../ids.ts";
import type { PreparedCheckoutSnapshot } from "./prepare-snapshot.ts";

export interface PrepareSnapshotRepository {
  save(snapshot: PreparedCheckoutSnapshot): Promise<void>;
  get(shopId: ShopId, prepareId: string): Promise<PreparedCheckoutSnapshot | undefined>;
}
