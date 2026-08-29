import { readCart, writeCart } from "./cart-storage.ts";

export function CartButton(props: { sku: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const items = readCart();
        const existing = items.find((item) => item.sku === props.sku);
        if (existing) {
          existing.quantity += 1;
        } else {
          items.push({ sku: props.sku, quantity: 1 });
        }
        writeCart(items);
      }}
    >
      Do koszyka
    </button>
  );
}
