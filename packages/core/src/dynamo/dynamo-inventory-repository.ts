import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { OrderId, ShopId, Sku } from "../ids.ts";
import type { Inventory, InventoryEvent, Reservation } from "../inventory/inventory.ts";
import type { InventoryRepository } from "../inventory/inventory-repository.ts";
import { inventoryReserveUpdate, keys } from "./keys.ts";

export class DynamoInventoryRepository implements InventoryRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(shopId: ShopId, sku: Sku) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.inventory(shopId, sku),
      }),
    );
    return result.Item ? toInventory(result.Item) : undefined;
  }

  async save(inventory: Inventory) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...keys.inventory(inventory.shopId, inventory.sku),
          shopId: inventory.shopId,
          sku: inventory.sku,
          onHand: inventory.onHand,
          reserved: inventory.reserved,
          version: inventory.version,
        },
      }),
    );
  }

  async appendEvent(event: InventoryEvent) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toEventItem(event),
      }),
    );
  }

  async listEvents(shopId: ShopId, sku: Sku) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `SHOP#${shopId}`,
          ":sk": `INVEVT#${sku}#`,
        },
      }),
    );
    return (result.Items ?? []).map(toEvent);
  }

  async getReservationLine(shopId: ShopId, orderId: OrderId, sku: Sku) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.reservation(shopId, orderId, sku),
      }),
    );
    return result.Item ? toReservation(result.Item) : undefined;
  }

  async listReservationsForOrder(shopId: ShopId, orderId: OrderId) {
    const prefix = `RESERVATION#${orderId}#`;
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `SHOP#${shopId}`,
          ":sk": prefix,
        },
      }),
    );
    return (result.Items ?? []).map(toReservation);
  }

  async saveReservation(reservation: Reservation) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toReservationItem(reservation),
      }),
    );
  }

  async listOpenExpired(shopId: ShopId, now: Date) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk AND gsi1sk <= :now",
        FilterExpression: "#status = :open",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pk": `SHOP#${shopId}#RESERVATION`,
          ":now": now.toISOString(),
          ":open": "open",
        },
      }),
    );
    return (result.Items ?? []).map(toReservation);
  }

  async transactReserve(input: {
    inventory: Inventory;
    quantity: number;
    reservation: Reservation;
    event: InventoryEvent;
  }): Promise<void> {
    const invKey = keys.inventory(input.inventory.shopId, input.inventory.sku);
    const reserve = inventoryReserveUpdate(input.inventory, input.quantity);
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: invKey,
              UpdateExpression: reserve.update,
              ConditionExpression: reserve.condition,
              ExpressionAttributeValues: reserve.values,
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: toReservationItem(input.reservation),
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: toEventItem(input.event),
            },
          },
        ],
      }),
    );
  }
}

function toInventory(item: Record<string, unknown>): Inventory {
  return {
    shopId: item.shopId as ShopId,
    sku: item.sku as Sku,
    onHand: item.onHand as number,
    reserved: item.reserved as number,
    version: (item.version as number | undefined) ?? 0,
  };
}

function toEventItem(event: InventoryEvent): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...keys.inventoryEvent(event.shopId, event.sku, event.id),
    id: event.id,
    shopId: event.shopId,
    sku: event.sku,
    deltaOnHand: event.deltaOnHand,
    deltaReserved: event.deltaReserved,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
  if (event.orderId !== undefined) item.orderId = event.orderId;
  return item;
}

function toEvent(item: Record<string, unknown>): InventoryEvent {
  const event: InventoryEvent = {
    id: item.id as string,
    shopId: item.shopId as ShopId,
    sku: item.sku as Sku,
    deltaOnHand: item.deltaOnHand as number,
    deltaReserved: item.deltaReserved as number,
    reason: item.reason as InventoryEvent["reason"],
    createdAt: new Date(item.createdAt as string),
  };
  if (item.orderId !== undefined) event.orderId = item.orderId as OrderId;
  return event;
}

function toReservationItem(reservation: Reservation): Record<string, unknown> {
  const key = keys.reservation(reservation.shopId, reservation.orderId, reservation.sku);
  return {
    ...key,
    gsi1sk: reservation.expiresAt.toISOString(),
    shopId: reservation.shopId,
    orderId: reservation.orderId,
    sku: reservation.sku,
    quantity: reservation.quantity,
    expiresAt: reservation.expiresAt.toISOString(),
    status: reservation.status,
  };
}

function toReservation(item: Record<string, unknown>): Reservation {
  return {
    shopId: item.shopId as ShopId,
    orderId: item.orderId as OrderId,
    sku: item.sku as Sku,
    quantity: item.quantity as number,
    expiresAt: new Date(item.expiresAt as string),
    status: item.status as Reservation["status"],
  };
}
