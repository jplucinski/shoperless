import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  CartService,
  DomainError,
  DynamoInventoryRepository,
  DynamoOrderRepository,
  DynamoPrepareSnapshotRepository,
  DynamoProductRepository,
  InventoryService,
  OrderService,
  ProductService,
  SystemClock,
  UlidGenerator,
  createJsonLogger,
} from "@liteshop/core";
import { Resource } from "sst";

export function createServices() {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const tableName = Resource.Table.name;
  const ids = new UlidGenerator();
  const clock = new SystemClock();
  const logger = createJsonLogger();
  const products = new DynamoProductRepository(doc, tableName);
  const inventory = new DynamoInventoryRepository(doc, tableName);
  const orders = new DynamoOrderRepository(doc, tableName);
  const snapshots = new DynamoPrepareSnapshotRepository(doc, tableName);
  const productService = new ProductService({ products, ids });
  const stock = new InventoryService({ inventory, clock, ids });
  const cart = new CartService({ products, inventory });
  const orderService = new OrderService({
    orders,
    cart,
    stock,
    ids,
    clock,
    snapshots,
    logger,
  });
  return {
    products: productService,
    stock,
    cart,
    orders: orderService,
    snapshots,
    ids,
    clock,
    logger,
  };
}

export type AdminQueryResult<T> = { ok: true; data: T } | { ok: false };

export async function runAdminQuery<T>(
  fn: (services: ReturnType<typeof createServices>) => Promise<T>,
): Promise<AdminQueryResult<T>> {
  try {
    return { ok: true, data: await fn(createServices()) };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return { ok: false };
  }
}
