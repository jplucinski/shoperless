import type { Clock } from "../clock.ts";
import type { CartService } from "../cart/cart-service.ts";
import type { PreparedCheckout } from "../cart/cart.ts";
import type { PrepareSnapshotRepository } from "../cart/prepare-snapshot-repository.ts";
import { DomainError } from "../errors.ts";
import type { IdGenerator, OrderId, ShopId } from "../ids.ts";
import {
  DEFAULT_RESERVATION_TTL_MS,
  type InventoryService,
} from "../inventory/inventory-service.ts";
import type { Logger } from "../logging.ts";
import type {
  ApplyPaymentCommand,
  ApplyTrackingCommand,
  CreateOrderCommand,
  OrderMirror,
} from "./order.ts";
import type {
  ConfirmSaleLineTransact,
  OrderRepository,
  ReserveLineTransact,
} from "./order-repository.ts";

export class OrderService {
  constructor(
    private readonly deps: {
      orders: OrderRepository;
      cart: CartService;
      stock: InventoryService;
      ids: IdGenerator;
      clock: Clock;
      snapshots?: PrepareSnapshotRepository;
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
    const prepared = await this.resolvePrepared(cmd);
    const id = this.deps.ids.orderId();
    const createdAt = cmd.datetimeOrder ? new Date(cmd.datetimeOrder) : this.deps.clock.now();
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

    const reserveLines = await this.buildReserveLines(cmd.shopId, id, prepared.lines);

    if (this.deps.orders.transactCreateOrder) {
      const outcome = await this.deps.orders.transactCreateOrder({ order, reserveLines });
      if (outcome === "duplicate") {
        const existing = await this.deps.orders.getByExternalId(
          cmd.shopId,
          order.externalOrderId,
        );
        if (!existing) {
          throw new DomainError("ORDER_NOT_FOUND", "duplicate create without order");
        }
        this.deps.logger?.info({
          shopId: cmd.shopId,
          operation: "order.create.duplicate",
          orderId: existing.id,
          externalOrderId: order.externalOrderId,
          correlationId: this.correlationId(),
        });
        return { order: existing, created: false };
      }
      this.deps.logger?.info({
        shopId: cmd.shopId,
        operation: "order.create",
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        correlationId: this.correlationId(),
      });
      return { order, created: true };
    }

    try {
      for (const line of prepared.lines) {
        await this.deps.stock.reserve(cmd.shopId, line.sku, line.quantity, id);
      }
    } catch (err) {
      await this.deps.stock.release(cmd.shopId, id);
      throw err;
    }
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

  private async resolvePrepared(cmd: CreateOrderCommand): Promise<PreparedCheckout> {
    const prepareId = cmd.cartId;
    if (prepareId && this.deps.snapshots) {
      const snapshot = await this.deps.snapshots.get(cmd.shopId, prepareId);
      if (snapshot && snapshot.expiresAt.getTime() > this.deps.clock.now().getTime()) {
        return {
          shopId: snapshot.shopId,
          currency: snapshot.currency,
          lines: snapshot.lines,
          total: snapshot.total,
        };
      }
      this.deps.logger?.info({
        shopId: cmd.shopId,
        operation: "checkout.prepare.miss",
        externalOrderId: prepareId,
        correlationId: this.correlationId(),
      });
    }
    return this.deps.cart.prepare(cmd.shopId, cmd.items);
  }

  private async buildReserveLines(
    shopId: ShopId,
    orderId: OrderId,
    lines: Array<{ sku: string; quantity: number }>,
  ): Promise<ReserveLineTransact[]> {
    const expiresAt = new Date(
      this.deps.clock.now().getTime() + DEFAULT_RESERVATION_TTL_MS,
    );
    const result: ReserveLineTransact[] = [];
    for (const line of lines) {
      const inventory = await this.deps.stock.get(shopId, line.sku);
      result.push({
        inventory,
        quantity: line.quantity,
        reservation: {
          shopId,
          orderId,
          sku: line.sku,
          quantity: line.quantity,
          status: "open",
          expiresAt,
        },
        event: {
          id: this.deps.ids.eventId(),
          shopId,
          sku: line.sku,
          deltaOnHand: 0,
          deltaReserved: line.quantity,
          reason: "RESERVATION",
          orderId,
          createdAt: this.deps.clock.now(),
        },
      });
    }
    return result;
  }

  private async buildConfirmSaleLines(
    shopId: ShopId,
    orderId: OrderId,
  ): Promise<ConfirmSaleLineTransact[]> {
    const reservations = await this.deps.stock.listReservationsForOrder(shopId, orderId);
    const lines: ConfirmSaleLineTransact[] = [];
    for (const reservation of reservations) {
      if (reservation.status === "sold") {
        continue;
      }
      const inventory = await this.deps.stock.get(shopId, reservation.sku);
      const deltaReserved = reservation.status === "open" ? -reservation.quantity : 0;
      lines.push({
        inventory,
        reservation,
        saleEvent: {
          id: this.deps.ids.eventId(),
          shopId,
          sku: reservation.sku,
          deltaOnHand: -reservation.quantity,
          deltaReserved,
          reason: "SALE",
          orderId,
          createdAt: this.deps.clock.now(),
        },
      });
    }
    return lines;
  }

  async applyPayment(cmd: ApplyPaymentCommand): Promise<OrderMirror> {
    const order = await this.deps.orders.getById(cmd.shopId, cmd.orderId);
    if (!order) {
      throw new DomainError("ORDER_NOT_FOUND", `order not found: ${cmd.orderId}`);
    }
    if (order.paymentStatus === cmd.paymentStatus) {
      this.logPaymentApply(order);
      return order;
    }
    if (order.paymentStatus === "PAID") {
      this.logPaymentApply(order);
      return order;
    }
    if (cmd.paymentStatus === "PAID") {
      const paidAmount = cmd.paidAmount ?? order.total;
      if (this.deps.orders.transactConfirmPayment) {
        const lines = await this.buildConfirmSaleLines(cmd.shopId, order.id);
        const outcome = await this.deps.orders.transactConfirmPayment({
          order,
          paidAmount,
          lines,
        });
        if (outcome === "already_paid") {
          const existing = await this.deps.orders.getById(cmd.shopId, cmd.orderId);
          if (!existing) {
            throw new DomainError("ORDER_NOT_FOUND", `order not found: ${cmd.orderId}`);
          }
          this.logPaymentApply(existing);
          return existing;
        }
        order.paymentStatus = "PAID";
        order.totalPaid = paidAmount;
      } else {
        await this.deps.stock.confirmSale(cmd.shopId, order.id);
        order.paymentStatus = "PAID";
        order.totalPaid = paidAmount;
        await this.deps.orders.save(order);
      }
    } else if (cmd.paymentStatus === "FAILED" || cmd.paymentStatus === "CANCELLED") {
      await this.deps.stock.release(cmd.shopId, order.id);
      order.paymentStatus = cmd.paymentStatus;
      if (cmd.paymentStatus === "CANCELLED") {
        order.status = "CANCELLED";
      }
      await this.deps.orders.save(order);
    } else {
      order.paymentStatus = cmd.paymentStatus;
      await this.deps.orders.save(order);
    }
    this.logPaymentApply(order);
    return order;
  }

  private logPaymentApply(order: OrderMirror) {
    this.deps.logger?.info({
      shopId: order.shopId,
      operation: "payment.apply",
      orderId: order.id,
      externalOrderId: order.externalOrderId,
      correlationId: this.correlationId(),
    });
  }

  async releaseExpiredReservations(shopId: ShopId): Promise<number> {
    const expired = await this.deps.stock.listOpenExpiredReservations(shopId);
    let released = 0;
    if (this.deps.orders.transactReleaseReservation) {
      for (const reservation of expired) {
        const order = await this.deps.orders.getById(shopId, reservation.orderId);
        if (!order) {
          continue;
        }
        const inventory = await this.deps.stock.get(shopId, reservation.sku);
        const outcome = await this.deps.orders.transactReleaseReservation({
          order,
          reservation,
          inventory,
          event: {
            id: this.deps.ids.eventId(),
            shopId,
            sku: reservation.sku,
            deltaOnHand: 0,
            deltaReserved: -reservation.quantity,
            reason: "RESERVATION_RELEASED",
            orderId: reservation.orderId,
            createdAt: this.deps.clock.now(),
          },
        });
        if (outcome === "released") {
          released += 1;
        }
      }
      return released;
    }
    const orderIds = [...new Set(expired.map((r) => r.orderId))];
    for (const orderId of orderIds) {
      const order = await this.deps.orders.getById(shopId, orderId);
      if (!order || order.paymentStatus === "PAID") {
        continue;
      }
      await this.deps.stock.release(shopId, orderId);
      released += 1;
    }
    return released;
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
