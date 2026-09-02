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
  const parsed = JSON.parse(raw) as { items?: CartItem[] };
  return parsed.items ?? [];
}

export function writeCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify({ items }));
  window.dispatchEvent(new Event(CART_EVENT));
}
