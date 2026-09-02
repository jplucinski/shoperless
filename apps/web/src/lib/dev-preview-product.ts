import { SEED_SHOP_ID, type Product } from "@liteshop/core";

export const DEV_PREVIEW_PRODUCT: Product = {
  id: "prd_preview",
  shopId: SEED_SHOP_ID,
  sku: "TOWEL-BLUE",
  slug: "blue-towel",
  name: "Blue Towel",
  description: "Soft",
  images: [],
  price: 19900,
  status: "active",
  metadata: {},
};
