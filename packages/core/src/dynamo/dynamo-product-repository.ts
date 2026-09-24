import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DuplicateSkuError, DuplicateSlugError } from "../errors.ts";
import type { ProductId, ShopId, Sku } from "../ids.ts";
import type { Product } from "../product/product.ts";
import type { ProductRepository } from "../product/product-repository.ts";
import { keys } from "./keys.ts";

export class DynamoProductRepository implements ProductRepository {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getById(shopId: ShopId, productId: ProductId) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.product(shopId, productId),
      }),
    );
    return result.Item ? toProduct(result.Item) : undefined;
  }

  async getBySku(shopId: ShopId, sku: Sku) {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.productSku(shopId, sku),
      }),
    );
    const productId = result.Item?.productId as ProductId | undefined;
    if (!productId) return undefined;
    return this.getById(shopId, productId);
  }

  async getBySlug(shopId: ShopId, slug: string) {
    const pointer = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: keys.productSlugPointer(shopId, slug),
      }),
    );
    const productId = pointer.Item?.productId as ProductId | undefined;
    if (productId) {
      return this.getById(shopId, productId);
    }
    const gsi = keys.productSlugGsi(shopId, slug);
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk AND gsi1sk = :sk",
        ExpressionAttributeValues: {
          ":pk": gsi.gsi1pk,
          ":sk": gsi.gsi1sk,
        },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0];
    return item ? toProduct(item) : undefined;
  }

  async list(shopId: ShopId) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `SHOP#${shopId}`,
          ":sk": "PRODUCT#",
        },
      }),
    );
    return (result.Items ?? []).map(toProduct);
  }

  async save(product: Product, options?: { create?: boolean }) {
    const slug = keys.productSlugGsi(product.shopId, product.slug);
    const productItem = {
      ...keys.product(product.shopId, product.id),
      ...slug,
      id: product.id,
      shopId: product.shopId,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      description: product.description,
      images: product.images,
      price: product.price,
      status: product.status,
      metadata: product.metadata,
    };
    const skuItem = {
      ...keys.productSku(product.shopId, product.sku),
      productId: product.id,
    };
    const slugItem = {
      ...keys.productSlugPointer(product.shopId, product.slug),
      productId: product.id,
    };
    if (options?.create) {
      try {
        await this.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.tableName,
                  Item: productItem,
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: skuItem,
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: slugItem,
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        );
      } catch (error) {
        if (error instanceof TransactionCanceledException) {
          const reasons = error.CancellationReasons ?? [];
          if (reasons[1]?.Code === "ConditionalCheckFailed") {
            throw new DuplicateSkuError(product.sku);
          }
          if (reasons[2]?.Code === "ConditionalCheckFailed") {
            throw new DuplicateSlugError(product.slug);
          }
        }
        throw error;
      }
      return;
    }
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: productItem,
      }),
    );
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: skuItem,
        ConditionExpression: "attribute_not_exists(pk) OR productId = :productId",
        ExpressionAttributeValues: {
          ":productId": product.id,
        },
      }),
    );
  }
}

function toProduct(item: Record<string, unknown>): Product {
  return {
    id: item.id as Product["id"],
    shopId: item.shopId as Product["shopId"],
    sku: item.sku as Product["sku"],
    slug: item.slug as string,
    name: item.name as string,
    description: item.description as string,
    images: item.images as string[],
    price: item.price as number,
    status: item.status as Product["status"],
    metadata: item.metadata as Record<string, string>,
  };
}
