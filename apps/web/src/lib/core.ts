import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  CartService,
  DynamoInventoryRepository,
  DynamoOrderRepository,
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
  const productService = new ProductService({ products, ids });
  const stock = new InventoryService({ inventory, clock, ids });
  const cart = new CartService({ products, inventory });
  const orderService = new OrderService({
    orders,
    cart,
    stock,
    ids,
    logger,
  });
  return {
    products: productService,
    stock,
    cart,
    orders: orderService,
    logger,
  };
}

export async function runAdminQuery<T>(
  fn: (services: ReturnType<typeof createServices>) => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn(createServices());
  } catch {
    return undefined;
  }
}
