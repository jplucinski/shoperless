import { readCart } from "./cart-storage.ts";

export function CheckoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        const items = readCart();
        const response = await fetch("/api/checkout/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { message: string };
          throw new Error(body.message);
        }
        const prepared = await response.json();
        window.Furgonetka.Checkout.init({
          dataProviderCallback: () => Promise.resolve(prepared),
        });
      }}
    >
      Kasa
    </button>
  );
}
