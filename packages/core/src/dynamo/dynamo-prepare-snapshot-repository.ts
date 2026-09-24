import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { ShopId } from "../ids.ts";
import type { PreparedCheckoutSnapshot } from "../cart/prepare-snapshot.ts";
import type { PrepareSnapshotRepository } from "../cart/prepare-snapshot-repository.ts";
import { keys } from "./keys.ts";

export class DynamoPrepareSnapshotRepository implements PrepareSnapshotRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(snapshot: PreparedCheckoutSnapshot) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...keys.prepareSnapshot(snapshot.shopId, snapshot.prepareId),
          shopId: snapshot.shopId,
          prepareId: snapshot.prepareId,
          lines: snapshot.lines,
          total: snapshot.total,
          currency: snapshot.currency,
          expiresAt: snapshot.expiresAt.toISOString(),
        },
      }),
    );
  }

  async get(shopId: ShopId, prepareId: string) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.prepareSnapshot(shopId, prepareId),
      }),
    );
    if (!result.Item) return undefined;
    return {
      shopId: result.Item.shopId as ShopId,
      prepareId: result.Item.prepareId as string,
      lines: result.Item.lines as PreparedCheckoutSnapshot["lines"],
      total: result.Item.total as number,
      currency: "PLN" as const,
      expiresAt: new Date(result.Item.expiresAt as string),
    };
  }
}
