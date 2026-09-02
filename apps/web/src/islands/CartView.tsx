import { useEffect, useMemo, useState } from "react";
import { CheckoutButton } from "./CheckoutButton.tsx";
import { type CartItem, readCart, writeCart } from "./cart-storage.ts";

function formatPln(grosze: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
    grosze / 100,
  );
}

interface CatalogLine {
  name: string;
  unitPrice: number;
}

const FALLBACK: Record<string, CatalogLine> = {
  "TOWEL-BLUE": { name: "Blue Towel", unitPrice: 19900 },
};

export function CartView() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogLine>>(FALLBACK);

  useEffect(() => {
    const add = new URLSearchParams(window.location.search).get("add");
    const current = readCart();
    if (add) {
      const existing = current.find((item) => item.sku === add);
      if (existing) {
        existing.quantity += 1;
      } else {
        current.push({ sku: add, quantity: 1 });
      }
      writeCart(current);
      window.history.replaceState({}, "", "/cart");
    }
    setItems(readCart());
    const lines = readCart();
    if (lines.length === 0) return;
    void fetch("/api/checkout/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          products?: { sku: string; name: string; price: number }[];
        };
        if (!body.products) return;
        const next = { ...FALLBACK };
        for (const product of body.products) {
          next[product.sku] = {
            name: product.name,
            unitPrice: Math.round(product.price * 100),
          };
        }
        setCatalog(next);
      })
      .catch(() => undefined);
  }, []);

  function persist(next: CartItem[]) {
    writeCart(next);
    setItems(next);
  }

  const lines = useMemo(
    () =>
      items.map((item) => {
        const meta = catalog[item.sku];
        const unitPrice = meta?.unitPrice;
        return {
          ...item,
          name: meta?.name ?? item.sku,
          unitPrice,
          lineTotal: unitPrice === undefined ? undefined : unitPrice * item.quantity,
        };
      }),
    [catalog, items],
  );

  const total = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const priced = lines.every((line) => line.unitPrice !== undefined);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center text-center">
        <h1 className="m-0 text-4xl font-bold">Koszyk jest pusty</h1>
        <p className="text-mute mx-auto mt-3 mb-8 max-w-md">
          Dodaj coś ze sklepu, potem wrócisz tutaj do kasy Furgonetka.
        </p>
        <a href="/" className="shop-btn no-underline">
          do sklepu
        </a>
      </div>
    );
  }

  const count = items.reduce((n, item) => n + item.quantity, 0);

  return (
    <div className="cart-page">
      <div className="cart-page-head">
        <div>
          <h1 className="text-4xl font-bold">Koszyk</h1>
          <p className="text-mute">{count} szt. w tej przeglądarce</p>
        </div>
        <a href="/" className="text-sm font-bold text-ink no-underline">
          sklep
        </a>
      </div>
      <div className="cart-layout">
        <div className="cart-table">
          <div className="cart-lines-head" aria-hidden="true">
            <span>Produkt</span>
            <span className="text-center">Ilość</span>
            <span className="text-right">Cena</span>
          </div>
          <ul className="cart-lines">
            {lines.map((line) => (
              <li key={line.sku} className="cart-line">
                <div className="cart-product">
                  <div className="cart-thumb">
                    <span className="text-paper text-lg font-bold">{line.name.slice(0, 1)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 font-semibold">{line.name}</p>
                    <p className="text-mute m-0 mt-1 text-sm">{line.sku}</p>
                    <button
                      type="button"
                      className="text-mute mt-2 cursor-pointer border-0 bg-transparent p-0 text-sm underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => persist(items.filter((item) => item.sku !== line.sku))}
                    >
                      Usuń
                    </button>
                  </div>
                </div>
                <div className="cart-qty">
                  <div className="flex items-center border border-ink">
                    <button
                      type="button"
                      className="shop-qty"
                      aria-label="Zmniejsz ilość"
                      onClick={() =>
                        persist(
                          line.quantity <= 1
                            ? items.filter((item) => item.sku !== line.sku)
                            : items.map((item) =>
                                item.sku === line.sku
                                  ? { ...item, quantity: item.quantity - 1 }
                                  : item,
                              ),
                        )
                      }
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      className="shop-qty"
                      aria-label="Zwiększ ilość"
                      onClick={() =>
                        persist(
                          items.map((item) =>
                            item.sku === line.sku ? { ...item, quantity: item.quantity + 1 } : item,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="cart-price">
                  {line.lineTotal === undefined ? "—" : formatPln(line.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <aside className="cart-summary">
          <h2 className="text-2xl font-bold">Podsumowanie</h2>
          <dl className="mt-5 mb-2 grid grid-cols-[1fr_auto] gap-y-3 text-sm">
            <dt className="text-mute">Produkty</dt>
            <dd className="m-0 font-semibold">{priced ? formatPln(total) : "Przy kasie"}</dd>
            <dt className="text-mute">Dostawa</dt>
            <dd className="m-0 text-right font-semibold">Furgonetka</dd>
          </dl>
          <div className="mt-4 mb-6 flex items-center justify-between border-t border-line pt-4">
            <span className="font-semibold">Razem</span>
            <span className="text-2xl font-bold">{priced ? formatPln(total) : "—"}</span>
          </div>
          <CheckoutButton className="shop-btn shop-btn-block" />
        </aside>
      </div>
    </div>
  );
}
