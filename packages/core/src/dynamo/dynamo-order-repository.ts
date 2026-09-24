import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { InsufficientStockError } from "../errors.ts";
import type { Inventory, InventoryEvent, Reservation } from "../inventory/inventory.ts";
import type { OrderId, ShopId } from "../ids.ts";
import type { Money } from "../money.ts";
import type { OrderMirror, ShippingAddress } from "../order/order.ts";
import type {
  ConfirmSaleLineTransact,
  OrderRepository,
  ReserveLineTransact,
} from "../order/order-repository.ts";
import {
  inventoryConfirmSaleUpdate,
  inventoryReleaseUpdate,
  inventoryReserveUpdate,
  keys,
} from "./keys.ts";

export class DynamoOrderRepository implements OrderRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getById(shopId: ShopId, orderId: OrderId) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.order(shopId, orderId),
      }),
    );
    return result.Item ? toOrder(result.Item) : undefined;
  }

  async getByExternalId(shopId: ShopId, externalOrderId: string) {
    const pointer = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.externalOrder(shopId, externalOrderId),
      }),
    );
    const orderId = pointer.Item?.orderId as OrderId | undefined;
    if (!orderId) return undefined;
    return this.getById(shopId, orderId);
  }

  async save(order: OrderMirror) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: toOrderItem(order),
      }),
    );
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...keys.externalOrder(order.shopId, order.externalOrderId),
          orderId: order.id,
        },
      }),
    );
  }

  async list(shopId: ShopId) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `SHOP#${shopId}`,
          ":sk": "ORDER#",
        },
      }),
    );
    return (result.Items ?? []).map(toOrder);
  }

  async transactCreateOrder(input: {
    order: OrderMirror;
    reserveLines: ReserveLineTransact[];
  }): Promise<"created" | "duplicate"> {
    const transactItems: Array<Record<string, unknown>> = [
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...keys.externalOrder(input.order.shopId, input.order.externalOrderId),
            orderId: input.order.id,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: toOrderItem(input.order),
        },
      },
    ];

    for (const line of input.reserveLines) {
      const reserve = inventoryReserveUpdate(line.inventory, line.quantity);
      transactItems.push(
        {
          Update: {
            TableName: this.tableName,
            Key: keys.inventory(line.inventory.shopId, line.inventory.sku),
            UpdateExpression: reserve.update,
            ConditionExpression: reserve.condition,
            ExpressionAttributeValues: reserve.values,
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: toReservationItem(line.reservation),
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: toEventItem(line.event),
          },
        },
      );
    }

    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: transactItems as never,
        }),
      );
      return "created";
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const reasons = error.CancellationReasons ?? [];
        if (reasons[0]?.Code === "ConditionalCheckFailed") {
          return "duplicate";
        }
        const failedSku = input.reserveLines[0]?.reservation.sku ?? "unknown";
        const failedQty = input.reserveLines[0]?.quantity ?? 0;
        throw new InsufficientStockError(failedSku, failedQty);
      }
      throw error;
    }
  }

  async transactConfirmPayment(input: {
    order: OrderMirror;
    paidAmount: Money;
    lines: ConfirmSaleLineTransact[];
  }): Promise<"confirmed" | "already_paid"> {
    const transactItems: Array<Record<string, unknown>> = [
      {
        Update: {
          TableName: this.tableName,
          Key: keys.order(input.order.shopId, input.order.id),
          UpdateExpression: "SET paymentStatus = :paid, totalPaid = :amount",
          ConditionExpression: "paymentStatus <> :paid",
          ExpressionAttributeValues: {
            ":paid": "PAID",
            ":amount": input.paidAmount,
          },
        },
      },
    ];

    for (const line of input.lines) {
      const sale = inventoryConfirmSaleUpdate(line.inventory, line.reservation);
      transactItems.push(
        {
          Update: {
            TableName: this.tableName,
            Key: keys.inventory(line.inventory.shopId, line.inventory.sku),
            UpdateExpression: sale.update,
            ConditionExpression: sale.condition,
            ExpressionAttributeValues: sale.values,
          },
        },
        {
          Update: {
            TableName: this.tableName,
            Key: keys.reservation(
              line.reservation.shopId,
              line.reservation.orderId,
              line.reservation.sku,
            ),
            UpdateExpression: "SET #status = :sold",
            ConditionExpression: "#status IN (:open, :released)",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":sold": "sold",
              ":open": "open",
              ":released": "released",
            },
          },
        },
        {
          Put: {
            TableName: this.tableName,
            Item: toEventItem(line.saleEvent),
          },
        },
      );
    }

    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: transactItems as never,
        }),
      );
      return "confirmed";
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        const reasons = error.CancellationReasons ?? [];
        if (reasons[0]?.Code === "ConditionalCheckFailed") {
          return "already_paid";
        }
      }
      throw error;
    }
  }

  async transactReleaseReservation(input: {
    order: OrderMirror;
    reservation: Reservation;
    inventory: Inventory;
    event: InventoryEvent;
  }): Promise<"released" | "skipped"> {
    const release = inventoryReleaseUpdate(input.inventory, input.reservation.quantity);
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tableName,
                Key: keys.order(input.order.shopId, input.order.id),
                UpdateExpression: "SET shopId = :shopId",
                ConditionExpression: "paymentStatus <> :paid",
                ExpressionAttributeValues: {
                  ":shopId": input.order.shopId,
                  ":paid": "PAID",
                },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: keys.reservation(
                  input.reservation.shopId,
                  input.reservation.orderId,
                  input.reservation.sku,
                ),
                UpdateExpression: "SET #status = :released",
                ConditionExpression: "#status = :open",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":released": "released",
                  ":open": "open",
                },
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: keys.inventory(input.inventory.shopId, input.inventory.sku),
                UpdateExpression: release.update,
                ConditionExpression: release.condition,
                ExpressionAttributeValues: release.values,
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
      return "released";
    } catch (error) {
      if (error instanceof TransactionCanceledException) {
        return "skipped";
      }
      throw error;
    }
  }
}

function toOrderItem(order: OrderMirror): Record<string, unknown> {
  return {
    ...keys.order(order.shopId, order.id),
    id: order.id,
    shopId: order.shopId,
    externalOrderId: order.externalOrderId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingStatus: order.shippingStatus,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    shippingAddress: order.shippingAddress,
    codAmount: order.codAmount,
    totalPaid: order.totalPaid,
    trackingNumber: order.trackingNumber,
    courierService: order.courierService,
    pickupPoint: order.pickupPoint,
    comment: order.comment,
  };
}

function toOrder(item: Record<string, unknown>): OrderMirror {
  return {
    id: item.id as OrderMirror["id"],
    shopId: item.shopId as OrderMirror["shopId"],
    externalOrderId: item.externalOrderId as string,
    status: item.status as OrderMirror["status"],
    paymentStatus: item.paymentStatus as OrderMirror["paymentStatus"],
    shippingStatus: item.shippingStatus as OrderMirror["shippingStatus"],
    items: item.items as OrderMirror["items"],
    total: item.total as number,
    createdAt: new Date(String(item.createdAt ?? new Date().toISOString())),
    shippingAddress: (item.shippingAddress ?? defaultAddress()) as ShippingAddress,
    codAmount: (item.codAmount as number | undefined) ?? 0,
    totalPaid: (item.totalPaid as number | undefined) ?? 0,
    trackingNumber: item.trackingNumber as string | undefined,
    courierService: item.courierService as string | undefined,
    pickupPoint: item.pickupPoint as string | undefined,
    comment: item.comment as string | undefined,
  };
}

function defaultAddress(): ShippingAddress {
  return {
    street: "",
    city: "",
    postcode: "",
    countryCode: "PL",
    phone: "",
    email: "",
  };
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
