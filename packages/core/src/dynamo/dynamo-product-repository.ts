import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    const products = await this.list(shopId);
    return products.find((p) => p.sku === sku);
  }

  async getBySlug(shopId: ShopId, slug: string) {
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

  async save(product: Product) {
    const slug = keys.productSlugGsi(product.shopId, product.slug);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
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
