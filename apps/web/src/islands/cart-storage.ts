export const CART_KEY = "liteshop.cart";
export const CART_EVENT = "liteshop:cart";

export interface CartItem {
  sku: string;
  quantity: number;
}

export function cartQuantity(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function readCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).sku === "string" &&
        Number.isInteger((item as CartItem).quantity) &&
        (item as CartItem).quantity > 0,
    );
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify({ items }));
  window.dispatchEvent(new Event(CART_EVENT));
}
