import type { ShopId } from "../ids.ts";
import type { PreparedCheckoutSnapshot } from "./prepare-snapshot.ts";
import type { PrepareSnapshotRepository } from "./prepare-snapshot-repository.ts";

function key(shopId: ShopId, prepareId: string): string {
  return `${shopId}#${prepareId}`;
}

export class MemoryPrepareSnapshotRepository implements PrepareSnapshotRepository {
  private readonly byId = new Map<string, PreparedCheckoutSnapshot>();

  async save(snapshot: PreparedCheckoutSnapshot) {
    this.byId.set(key(snapshot.shopId, snapshot.prepareId), {
      ...snapshot,
      lines: snapshot.lines.map((line) => ({ ...line })),
      expiresAt: new Date(snapshot.expiresAt),
    });
  }

  async get(shopId: ShopId, prepareId: string) {
    const found = this.byId.get(key(shopId, prepareId));
    if (!found) return undefined;
    return {
      ...found,
      lines: found.lines.map((line) => ({ ...line })),
      expiresAt: new Date(found.expiresAt),
    };
  }
}
