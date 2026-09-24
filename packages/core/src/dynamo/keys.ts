import type { Inventory, Reservation } from "../inventory/inventory.ts";

export const keys = {
  shop: (shopId: string) => ({ pk: `SHOP#${shopId}`, sk: "META" }),
  product: (shopId: string, productId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `PRODUCT#${productId}`,
  }),
  productSlugGsi: (shopId: string, slug: string) => ({
    gsi1pk: `SHOP#${shopId}#SLUG`,
    gsi1sk: slug,
  }),
  productSku: (shopId: string, sku: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `SKU#${sku}`,
  }),
  productSlugPointer: (shopId: string, slug: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `SLUG#${slug}`,
  }),
  prepareSnapshot: (shopId: string, prepareId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `PREPARE#${prepareId}`,
  }),
  inventory: (shopId: string, sku: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `INVENTORY#${sku}`,
  }),
  inventoryEvent: (shopId: string, sku: string, eventId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `INVEVT#${sku}#${eventId}`,
  }),
  order: (shopId: string, orderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `ORDER#${orderId}`,
  }),
  externalOrder: (shopId: string, externalOrderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `EXTORDER#${externalOrderId}`,
  }),
  reservation: (shopId: string, orderId: string, sku: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `RESERVATION#${orderId}#${sku}`,
    gsi1pk: `SHOP#${shopId}#RESERVATION`,
  }),
  furgonetka: (shopId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: "FURGONETKA",
  }),
};

/** Reserve stock with optimistic concurrency — never stores derived available. */
export function inventoryReserveUpdate(inventory: Inventory, quantity: number) {
  const minOnHand = inventory.reserved + quantity;
  return {
    condition: "version = :expectedVersion AND onHand >= :minOnHand",
    update:
      "SET reserved = reserved + :qty, " +
      "version = version + :one, " +
      "shopId = :shopId, sku = :sku",
    values: {
      ":qty": quantity,
      ":one": 1,
      ":expectedVersion": inventory.version,
      ":minOnHand": minOnHand,
      ":shopId": inventory.shopId,
      ":sku": inventory.sku,
    },
  };
}

export function inventoryConfirmSaleUpdate(inventory: Inventory, reservation: Reservation) {
  const qty = reservation.quantity;
  if (reservation.status === "open") {
    return {
      condition: "version = :expectedVersion AND reserved >= :qty",
      update:
        "SET onHand = onHand - :qty, reserved = reserved - :qty, version = version + :one",
      values: {
        ":qty": qty,
        ":one": 1,
        ":expectedVersion": inventory.version,
      },
    };
  }
  return {
    condition: "version = :expectedVersion",
    update: "SET onHand = onHand - :qty, version = version + :one",
    values: {
      ":qty": qty,
      ":one": 1,
      ":expectedVersion": inventory.version,
    },
  };
}

export function inventoryReleaseUpdate(inventory: Inventory, quantity: number) {
  return {
    condition: "version = :expectedVersion AND reserved >= :qty",
    update: "SET reserved = reserved - :qty, version = version + :one",
    values: {
      ":qty": quantity,
      ":one": 1,
      ":expectedVersion": inventory.version,
    },
  };
}
