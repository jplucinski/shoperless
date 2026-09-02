import { useEffect, useState } from "react";
import { CART_EVENT, cartQuantity, readCart } from "./cart-storage.ts";

export function CartCount() {
  const [n, setN] = useState(0);

  useEffect(() => {
    const sync = () => setN(cartQuantity(readCart()));
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <a href="/cart" className="font-bold text-ink no-underline">
      koszyk ({n})
    </a>
  );
}
