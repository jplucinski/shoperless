import { useEffect, useMemo, useState } from "react";
import { studioBySku } from "../lib/studio-works.ts";
import { CheckoutButton } from "./CheckoutButton.tsx";
import { type CartItem, readCart, writeCart } from "./cart-storage.ts";

function formatPln(grosze: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
    grosze / 100,
  );
}

function prace(count: number): string {
  if (count === 1) return "1 praca";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} prace`;
  return `${count} prac`;
}

interface CatalogLine {
  name: string;
  unitPrice: number;
}

let bootAdd: string | null | undefined;

function readInitialCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const current = readCart();
  if (bootAdd === undefined) {
    bootAdd = new URLSearchParams(window.location.search).get("add");
  }
  const add = bootAdd;
  bootAdd = null;
  if (!add) return current;
  const existing = current.find((item) => item.sku === add);
  if (existing) {
    existing.quantity += 1;
  } else {
    current.push({ sku: add, quantity: 1 });
  }
  writeCart(current);
  window.history.replaceState({}, "", "/cart");
  return readCart();
}

export function CartView(props: { checkoutUuid?: string }) {
  const [items, setItems] = useState<CartItem[]>(readInitialCart);
  const [catalog, setCatalog] = useState<Record<string, CatalogLine>>({});
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    const lines = readCart();
    if (lines.length === 0) return;
    void fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines }),
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          lines?: { sku: string; name: string; unitPrice: number }[];
          message?: string;
        };
        if (!response.ok) {
          setQuoteError(body.message ?? "Nie udało się wycenić koszyka.");
          return;
        }
        if (!body.lines) return;
        const next: Record<string, CatalogLine> = {};
        for (const line of body.lines) {
          next[line.sku] = { name: line.name, unitPrice: line.unitPrice };
        }
        setCatalog(next);
        setQuoteError(null);
      })
      .catch(() => setQuoteError("Nie udało się wycenić koszyka."));
  }, []);

  function persist(next: CartItem[]) {
    writeCart(next);
    setItems(next);
  }

  const lines = useMemo(
    () =>
      items.map((item) => {
        const meta = catalog[item.sku];
        const art = studioBySku(item.sku);
        const unitPrice = meta?.unitPrice;
        const catalogName = meta?.name?.trim();
        return {
          ...item,
          title:
            (catalogName && catalogName !== item.sku ? catalogName : undefined) ??
            art?.name ??
            item.sku,
          artist: art?.artist,
          photo: art?.images[0],
          unitPrice,
          lineTotal: unitPrice === undefined ? undefined : unitPrice * item.quantity,
        };
      }),
    [catalog, items],
  );

  const total = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const priced = lines.every((line) => line.unitPrice !== undefined);
  const count = items.reduce((n, item) => n + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <h1 className="cart-title">Koszyk jest pusty</h1>
        <p className="text-mute cart-lead">Wybierz pracę w sklepie.</p>
        <a href="/" className="shop-btn no-underline">
          Sklep
          <span className="btn-orb" aria-hidden="true">
            ↗
          </span>
        </a>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1 className="cart-title">Koszyk</h1>
      <p className="text-mute cart-lead">{prace(count)}</p>
      {quoteError ? <p className="cart-quote-error">{quoteError}</p> : null}
      <div className="cart-layout">
        <ul className="cart-lines">
          {lines.map((line) => (
            <li key={line.sku} className="cart-line">
              {line.photo ? (
                <img className="cart-photo" src={line.photo} alt={line.title} />
              ) : (
                <div className="cart-photo cart-photo-fallback" aria-hidden="true">
                  {line.title.slice(0, 1)}
                </div>
              )}
              <div className="cart-copy">
                <p className="cart-name">{line.title}</p>
                {line.artist ? <p className="text-mute cart-artist">{line.artist}</p> : null}
                <button
                  type="button"
                  className="cart-remove"
                  onClick={() => persist(items.filter((item) => item.sku !== line.sku))}
                >
                  Usuń
                </button>
              </div>
              <div className="cart-qty">
                <div className="cart-stepper">
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
                  <span className="cart-count">{line.quantity}</span>
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
                {line.lineTotal === undefined ? "Przy kasie" : formatPln(line.lineTotal)}
              </p>
            </li>
          ))}
        </ul>
        <aside className="cart-plate">
          <p className="cart-plate-kicker">Razem</p>
          <p className="cart-plate-total">{priced ? formatPln(total) : "Przy kasie"}</p>
          <p className="text-mute cart-plate-note">Dostawa w kasie Furgonetka.</p>
          {props.checkoutUuid ? <CheckoutButton checkoutUuid={props.checkoutUuid} /> : null}
        </aside>
      </div>
    </div>
  );
}
