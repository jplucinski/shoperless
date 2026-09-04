import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { OrderId, ShopId } from "../ids.ts";
import type { OrderMirror, ShippingAddress } from "../order/order.ts";
import type { OrderRepository } from "../order/order-repository.ts";
import { keys } from "./keys.ts";

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
        Item: {
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
        },
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
