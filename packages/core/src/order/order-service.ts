import type { CartService } from "../cart/cart-service.ts";
import { DomainError } from "../errors.ts";
import type { IdGenerator, OrderId, ShopId } from "../ids.ts";
import type { InventoryService } from "../inventory/inventory-service.ts";
import type { Logger } from "../logging.ts";
import type {
  ApplyPaymentCommand,
  ApplyTrackingCommand,
  CreateOrderCommand,
  OrderMirror,
} from "./order.ts";
import type { OrderRepository } from "./order-repository.ts";

export class OrderService {
  constructor(
    private readonly deps: {
      orders: OrderRepository;
      cart: CartService;
      stock: InventoryService;
      ids: IdGenerator;
      logger?: Logger;
    },
  ) {}

  private correlationId(): string {
    return crypto.randomUUID();
  }

  async createFromExternal(
    cmd: CreateOrderCommand,
  ): Promise<{ order: OrderMirror; created: boolean }> {
    const idempotencyKey = cmd.cartId;
    if (idempotencyKey) {
      const existing = await this.deps.orders.getByExternalId(cmd.shopId, idempotencyKey);
      if (existing) {
        this.deps.logger?.info({
          shopId: cmd.shopId,
          operation: "order.create.duplicate",
          orderId: existing.id,
          externalOrderId: idempotencyKey,
          correlationId: this.correlationId(),
        });
        return { order: existing, created: false };
      }
    }
    const prepared = await this.deps.cart.prepare(cmd.shopId, cmd.items);
    const id = this.deps.ids.orderId();
    try {
      for (const line of prepared.lines) {
        await this.deps.stock.reserve(cmd.shopId, line.sku, line.quantity, id);
      }
    } catch (err) {
      await this.deps.stock.release(cmd.shopId, id);
      throw err;
    }
    const createdAt = cmd.datetimeOrder ? new Date(cmd.datetimeOrder) : new Date();
    const order: OrderMirror = {
      id,
      shopId: cmd.shopId,
      externalOrderId: idempotencyKey ?? id,
      status: "CREATED",
      paymentStatus: "PENDING",
      shippingStatus: "NOT_SHIPPED",
      items: prepared.lines.map((line) => ({
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      total: prepared.total,
      createdAt,
      shippingAddress: cmd.shippingAddress,
      codAmount: cmd.codAmount ?? 0,
      totalPaid: 0,
      courierService: cmd.service,
      pickupPoint: cmd.pickupPoint,
      comment: cmd.comment,
    };
    await this.deps.orders.save(order);
    this.deps.logger?.info({
      shopId: cmd.shopId,
      operation: "order.create",
      orderId: order.id,
      externalOrderId: order.externalOrderId,
      correlationId: this.correlationId(),
    });
    return { order, created: true };
  }

  async applyPayment(cmd: ApplyPaymentCommand): Promise<OrderMirror> {
    const order = await this.deps.orders.getById(cmd.shopId, cmd.orderId);
    if (!order) {
      throw new DomainError("ORDER_NOT_FOUND", `order not found: ${cmd.orderId}`);
    }
    if (order.paymentStatus === cmd.paymentStatus) {
      this.deps.logger?.info({
        shopId: cmd.shopId,
        operation: "payment.apply",
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        correlationId: this.correlationId(),
      });
      return order;
    }
    if (order.paymentStatus === "PAID") {
      this.deps.logger?.info({
        shopId: cmd.shopId,
        operation: "payment.apply",
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        correlationId: this.correlationId(),
      });
      return order;
    }
    if (cmd.paymentStatus === "PAID") {
      await this.deps.stock.confirmSale(cmd.shopId, order.id);
      order.paymentStatus = "PAID";
      order.totalPaid = cmd.paidAmount ?? order.total;
    } else if (cmd.paymentStatus === "FAILED" || cmd.paymentStatus === "CANCELLED") {
      await this.deps.stock.release(cmd.shopId, order.id);
      order.paymentStatus = cmd.paymentStatus;
      if (cmd.paymentStatus === "CANCELLED") {
        order.status = "CANCELLED";
      }
    } else {
      order.paymentStatus = cmd.paymentStatus;
    }
    await this.deps.orders.save(order);
    this.deps.logger?.info({
      shopId: cmd.shopId,
      operation: "payment.apply",
      orderId: order.id,
      externalOrderId: order.externalOrderId,
      correlationId: this.correlationId(),
    });
    return order;
  }

  async applyTracking(cmd: ApplyTrackingCommand): Promise<OrderMirror> {
    const order = await this.deps.orders.getById(cmd.shopId, cmd.orderId);
    if (!order) {
      throw new DomainError("ORDER_NOT_FOUND", `order not found: ${cmd.orderId}`);
    }
    order.trackingNumber = cmd.trackingNumber;
    order.courierService = cmd.courierService;
    order.shippingStatus = "IN_TRANSIT";
    await this.deps.orders.save(order);
    return order;
  }

  async list(shopId: ShopId): Promise<OrderMirror[]> {
    return this.deps.orders.list(shopId);
  }

  async listSince(
    shopId: ShopId,
    datetime: string | undefined,
    limit = 100,
  ): Promise<OrderMirror[]> {
    const all = await this.deps.orders.list(shopId);
    const filtered = datetime
      ? all.filter((order) => order.createdAt > new Date(datetime))
      : all;
    return filtered
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
  }

  async get(shopId: ShopId, orderId: OrderId): Promise<OrderMirror> {
    const order = await this.deps.orders.getById(shopId, orderId);
    if (!order) {
      throw new DomainError("ORDER_NOT_FOUND", `order not found: ${orderId}`);
    }
    return order;
  }
}
