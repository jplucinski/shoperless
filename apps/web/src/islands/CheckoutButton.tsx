import { useEffect } from "react";
import { readCart } from "./cart-storage.ts";

export function CheckoutButton(props: { checkoutUuid: string }) {
  useEffect(() => {
    const init = () => {
      window.Furgonetka?.Checkout.init({
        checkoutUuid: props.checkoutUuid,
        defaultButtonContainer: "#furgonetka-checkout",
        dataProviderCallback: async () => {
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
          return response.json();
        },
      });
    };
    if (window.Furgonetka?.Checkout) {
      init();
      return;
    }
    const onReady = () => init();
    window.addEventListener("furgonetka.checkout.ready", onReady);
    return () => window.removeEventListener("furgonetka.checkout.ready", onReady);
  }, [props.checkoutUuid]);

  return <div id="furgonetka-checkout" className="min-h-12 w-full" />;
}
