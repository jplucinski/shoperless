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
  inventory: (shopId: string, sku: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `INVENTORY#${sku}`,
  }),
  inventoryEvent: (shopId: string, eventId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `INVEVT#${eventId}`,
  }),
  order: (shopId: string, orderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `ORDER#${orderId}`,
  }),
  externalOrder: (shopId: string, externalOrderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `EXTORDER#${externalOrderId}`,
  }),
  reservation: (shopId: string, orderId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: `RESERVATION#${orderId}`,
    gsi1pk: `SHOP#${shopId}#RESERVATION`,
  }),
  furgonetka: (shopId: string) => ({
    pk: `SHOP#${shopId}`,
    sk: "FURGONETKA",
  }),
};

export const RESERVE_CONDITION =
  "attribute_not_exists(pk) OR (onHand - reserved >= :qty)";
