# Willett storefront chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Spec: [docs/superpowers/specs/2026-09-02-willett-storefront-chrome-design.md](../specs/2026-09-02-willett-storefront-chrome-design.md). Language: [docs/CONTEXT.md](../../CONTEXT.md).

**Goal:** Restyle the LiteShop customer storefront chrome to match Willett Space (grotesk, off-white, lowercase header, rectangular controls) without changing catalog/PDP/cart structure or Furgonetka checkout.

**Architecture:** Keep boutique tokens as the default `@theme` so `AdminLayout` is visually unchanged. `ShopLayout` sets `body.shop` and CSS variables on `.shop` override paper/ink/type/buttons. Cart header count is a React island that reads `liteshop.cart` and listens to `liteshop:cart` (same tab) plus `storage` (other tabs).

**Tech Stack:** Astro 5, React islands, Tailwind 4 (`@theme` + utilities), Vitest 3 (`environment: "node"`), Schibsted Grotesk via Google Fonts.

## Global Constraints

- Visual reference is willettspace.com chrome only — no Willett logo, photography, Unica 77, or editorial home.
- Cart stays `/cart`. No overlay. Header `koszyk (n)` is a link.
- `n` is the sum of line quantities, not the number of SKUs. Empty: `koszyk (0)`.
- Chrome copy is Polish lowercase: `sklep`, `koszyk (n)`, `regulamin`, `rodo`, `kontakt`.
- Footer wordmark text is `LiteShop`.
- No `menu` toggle.
- Do not edit admin pages or `AdminLayout.astro`.
- Do not change `/api/checkout/prepare` or `Furgonetka.Checkout.init` behaviour.
- Package manager is **pnpm**. Tests: `pnpm --filter @liteshop/web test`.
- `available` / checkout / inventory domain rules are out of scope.

---

## File map

```text
apps/web/src/islands/cart-storage.ts          modify — CART_EVENT, cartQuantity, dispatch
apps/web/src/islands/cart-storage.test.ts     create
apps/web/src/islands/CartCount.tsx            create
apps/web/src/styles/global.css                modify — .shop tokens, .shop .shop-btn, cart radius
apps/web/src/layouts/ShopLayout.astro         modify — fonts, fixed header, footer, body.shop
apps/web/src/pages/index.astro                modify — drop boutique catalog chrome
apps/web/src/pages/products/[slug].astro      modify — square media, sklep back link
apps/web/src/islands/CartView.tsx             modify — empty/qty/headings
apps/web/src/pages/kontakt.astro              modify — drop rounded box
apps/web/src/pages/regulamin.astro            modify — drop font-display
apps/web/src/pages/rodo.astro                 modify — drop font-display
```

Unchanged: `CartButton.tsx` (still `shop-btn`), `CheckoutButton.tsx`, `AdminLayout.astro`, admin pages.

---

### Task 1: Cart quantity + same-tab event

**Files:**
- Modify: `apps/web/src/islands/cart-storage.ts`
- Create: `apps/web/src/islands/cart-storage.test.ts`

**Interfaces:**
- Consumes: existing `CartItem`, `CART_KEY`, `readCart`
- Produces:
  - `export const CART_EVENT = "liteshop:cart"`
  - `export function cartQuantity(items: CartItem[]): number`
  - `writeCart(items: CartItem[]): void` still persists `{ items }` then `window.dispatchEvent(new Event(CART_EVENT))`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/islands/cart-storage.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_EVENT, CART_KEY, cartQuantity, readCart, writeCart } from "./cart-storage.ts";

function installCartMemory() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  const dispatched: string[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: (event: Event) => {
      dispatched.push(event.type);
      return true;
    },
  });
  return { dispatched };
}

describe("cartQuantity", () => {
  it("sums quantities", () => {
    expect(cartQuantity([])).toBe(0);
    expect(
      cartQuantity([
        { sku: "A", quantity: 1 },
        { sku: "B", quantity: 3 },
      ]),
    ).toBe(4);
  });
});

describe("writeCart", () => {
  beforeEach(() => {
    installCartMemory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists items and dispatches liteshop:cart", () => {
    const { dispatched } = installCartMemory();
    writeCart([{ sku: "TOWEL-BLUE", quantity: 2 }]);
    expect(readCart()).toEqual([{ sku: "TOWEL-BLUE", quantity: 2 }]);
    expect(JSON.parse(localStorage.getItem(CART_KEY) ?? "{}")).toEqual({
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
    });
    expect(dispatched).toContain(CART_EVENT);
  });
});
```

Note: `writeCart` test calls `installCartMemory` twice if `beforeEach` also calls it — **do not** double-install. Use only `beforeEach`:

```ts
let dispatched: string[] = [];

beforeEach(() => {
  dispatched = installCartMemory().dispatched;
});
```

and in the test `expect(dispatched).toContain(CART_EVENT)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/web test src/islands/cart-storage.test.ts`

Expected: FAIL — `cartQuantity` / `CART_EVENT` is not exported.

- [ ] **Step 3: Implement**

Replace `apps/web/src/islands/cart-storage.ts` with:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @liteshop/web test src/islands/cart-storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/islands/cart-storage.ts apps/web/src/islands/cart-storage.test.ts
git commit -m "$(cat <<'EOF'
Add cart quantity helper and same-tab cart event.

EOF
)"
```

---

### Task 2: Header cart count island

**Files:**
- Create: `apps/web/src/islands/CartCount.tsx`

**Interfaces:**
- Consumes: `CART_EVENT`, `cartQuantity`, `readCart` from `./cart-storage.ts`
- Produces: `export function CartCount(): JSX.Element` — `<a href="/cart">koszyk ({n})</a>`

- [ ] **Step 1: Create island**

There is no React test runner in `@liteshop/web`. Do not add happy-dom. Behaviour is covered by Task 1 + browser check in Task 7.

Create `apps/web/src/islands/CartCount.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck island compiles with the rest of web later; for now**

Run: `pnpm --filter @liteshop/web test src/islands/cart-storage.test.ts`

Expected: PASS (no regression).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/islands/CartCount.tsx
git commit -m "$(cat <<'EOF'
Add storefront cart count island.

EOF
)"
```

---

### Task 3: Storefront tokens on `body.shop`

**Files:**
- Modify: `apps/web/src/styles/global.css`

**Interfaces:**
- Consumes: existing `@theme` boutique tokens (keep `--color-moss`, `--color-moss-dark`, Figtree/Fraunces defaults for admin)
- Produces: `.shop` CSS variable overrides; `.shop .shop-btn` / `.shop .shop-btn-ghost` / `.shop .shop-input`; cart chrome radius 0

- [ ] **Step 1: Keep `@theme` boutique defaults, add `--color-mark`**

In `@theme` add:

```css
  --color-mark: #6f140e;
```

Do not remove moss or change default linen/paper/ink/fonts in `@theme`.

- [ ] **Step 2: After the `body { ... }` block, add storefront overrides**

```css
.shop {
  --font-display: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
  --color-linen: #f6f4eb;
  --color-paper: #fbfaee;
  --color-ink: #241500;
  --color-mute: color-mix(in srgb, var(--color-ink) 55%, var(--color-linen));
  --color-line: color-mix(in srgb, var(--color-ink) 18%, var(--color-linen));
  font-family: var(--font-sans);
  font-weight: 500;
}

.shop .shop-btn {
  border-radius: 0;
  background: var(--color-ink);
  color: var(--color-paper);
  font-weight: 700;
  letter-spacing: 0;
}

.shop .shop-btn:hover {
  background: var(--color-mark);
}

.shop .shop-btn-ghost {
  background: transparent;
  color: var(--color-ink);
  box-shadow: inset 0 0 0 1px var(--color-ink);
}

.shop .shop-btn-ghost:hover {
  background: var(--color-paper);
}

.shop .shop-input {
  border-radius: 0;
}
```

- [ ] **Step 3: Square cart chrome**

Change `.cart-layout` to `border-radius: 0`.
Change `.cart-thumb` to `border-radius: 0`.

Leave the rest of the cart grid as-is.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/styles/global.css
git commit -m "$(cat <<'EOF'
Scope Willett tokens to storefront body.shop.

EOF
)"
```

---

### Task 4: ShopLayout chrome

**Files:**
- Modify: `apps/web/src/layouts/ShopLayout.astro`

**Interfaces:**
- Consumes: `CartCount` from `../islands/CartCount.tsx`
- Produces: storefront shell — `body.shop`, fixed header `sklep` + `CartCount`, footer wordmark + legal

- [ ] **Step 1: Replace `ShopLayout.astro`**

```astro
---
import { CartCount } from "../islands/CartCount.tsx";
import "../styles/global.css";

interface Props {
  title: string;
  wide?: boolean;
}

const { title, wide = false } = Astro.props;
---
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700&display=swap"
      rel="stylesheet"
    />
    <slot name="head" />
  </head>
  <body class="shop flex min-h-screen flex-col">
    <header class="fixed top-0 left-0 z-50 flex w-full items-center justify-between px-5 py-4 md:px-10 md:py-5">
      <a href="/" class="text-ink text-[18px] leading-none font-bold no-underline">sklep</a>
      <CartCount client:load />
    </header>
    <main
      class:list={[
        "mx-auto w-full flex-1 self-center px-5 pt-24 pb-8 md:px-10",
        wide ? "flex max-w-4xl flex-col justify-center" : "max-w-5xl",
      ]}
    >
      <slot />
    </main>
    <footer class="mt-auto px-5 pt-32 pb-10 md:px-10 md:pt-52">
      <a href="/" class="text-ink block text-5xl leading-none font-bold no-underline md:text-7xl">
        LiteShop
      </a>
      <nav class="text-mute mt-10 flex flex-wrap gap-6 text-sm font-bold">
        <a href="/regulamin" class="text-mute no-underline hover:text-ink">regulamin</a>
        <a href="/rodo" class="text-mute no-underline hover:text-ink">rodo</a>
        <a href="/kontakt" class="text-mute no-underline hover:text-ink">kontakt</a>
      </nav>
    </footer>
  </body>
</html>
```

Remove unused `path` / active moss classes.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/layouts/ShopLayout.astro
git commit -m "$(cat <<'EOF'
Restyle storefront header and footer.

EOF
)"
```

---

### Task 5: Catalog and PDP

**Files:**
- Modify: `apps/web/src/pages/index.astro`
- Modify: `apps/web/src/pages/products/[slug].astro`

**Interfaces:**
- Consumes: `ShopLayout`, `formatPln`, existing product fetch
- Produces: 4:5 unrounded placeholders; no Katalog eyebrow / boutique cards; PDP back link `sklep`

- [ ] **Step 1: Home listing**

Keep the frontmatter. Replace the `<ShopLayout>` body with:

```astro
<ShopLayout title="LiteShop">
  {
    catalogError && listed.length === 0 ? (
      <p class="border-line bg-paper text-mute border px-5 py-4">
        Katalog chwilowo niedostępny (Dynamo / SST).
      </p>
    ) : listed.length === 0 ? (
      <p class="text-mute">Brak aktywnych produktów.</p>
    ) : (
      <ul class="m-0 grid list-none grid-cols-1 gap-10 p-0 sm:grid-cols-2">
        {listed.map((product) => (
          <li>
            <a href={`/products/${product.slug}`} class="text-ink block no-underline">
              <div class="mb-3 flex aspect-[4/5] items-end bg-[linear-gradient(160deg,#d7e0d4,#c5b7a5)] px-4 py-3">
                <span class="text-paper text-2xl font-bold">{product.name.slice(0, 1)}</span>
              </div>
              <h2 class="m-0 text-base font-bold">{product.name}</h2>
              <p class="mt-1 mb-0">{formatPln(product.price)}</p>
            </a>
          </li>
        ))}
      </ul>
    )
  }
</ShopLayout>
```

- [ ] **Step 2: PDP**

In `apps/web/src/pages/products/[slug].astro` replace the layout body (keep frontmatter):

```astro
<ShopLayout title={product.name}>
  <p class="mb-6">
    <a href="/" class="text-ink text-sm font-bold no-underline">sklep</a>
  </p>
  <article class="grid gap-10 md:grid-cols-2">
    <div class="flex min-h-72 items-end bg-[linear-gradient(160deg,#d7e0d4,#c5b7a5)] px-6 py-5">
      <span class="text-paper text-5xl font-bold">{product.name.slice(0, 1)}</span>
    </div>
    <div>
      <h1 class="m-0 text-4xl font-bold">{product.name}</h1>
      <p class="mt-3 text-2xl font-bold">{formatPln(product.price)}</p>
      <p class="text-mute mt-4 max-w-md leading-relaxed">{product.description}</p>
      <div class="mt-8">
        <CartButton client:load sku={product.sku} />
      </div>
    </div>
  </article>
</ShopLayout>
```

`CartButton` stays `className="shop-btn no-underline"`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/index.astro apps/web/src/pages/products/[slug].astro
git commit -m "$(cat <<'EOF'
Strip boutique chrome from catalog and product pages.

EOF
)"
```

---

### Task 6: Cart view and legal pages

**Files:**
- Modify: `apps/web/src/islands/CartView.tsx`
- Modify: `apps/web/src/pages/kontakt.astro`
- Modify: `apps/web/src/pages/regulamin.astro`
- Modify: `apps/web/src/pages/rodo.astro`

**Interfaces:**
- Consumes: `writeCart` (now dispatches `CART_EVENT`), `CheckoutButton`, existing line logic
- Produces: unrounded empty/qty; lowercase `sklep`; legal pages without `font-display` / rounded boxes

- [ ] **Step 1: Empty + header + qty in CartView**

Empty state — replace the framed card with:

```tsx
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
```

Filled header continue link:

```tsx
        <a href="/" className="text-sm font-bold text-ink no-underline">
          sklep
        </a>
```

Headings: remove `font-display` from h1/h2/total; use `font-bold`.

Thumb initial: `className="text-paper text-lg font-bold"`.

Quantity control — replace `rounded-full` wrapper with:

```tsx
                  <div className="flex items-center border border-ink">
```

Do not change `CheckoutButton` or prepare/init.

- [ ] **Step 2: Legal pages**

`kontakt.astro` — drop the rounded box:

```astro
<ShopLayout title="Kontakt">
  <article class="max-w-2xl">
    <h1 class="m-0 text-4xl font-bold">Kontakt</h1>
    <p class="text-mute mt-3 mb-8">Pytania o zamówienie, reklamację albo dane osobowe.</p>
    <p class="m-0 font-bold">LiteShop</p>
    <p class="text-mute mt-2 mb-0">e-mail: kontakt@localhost</p>
    <p class="text-mute mt-2 mb-0">Odpowiadamy w dni robocze.</p>
  </article>
</ShopLayout>
```

`regulamin.astro` h1: `class="m-0 text-4xl font-bold"` (remove `font-display font-medium`).

`rodo.astro` h1: same.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/islands/CartView.tsx apps/web/src/pages/kontakt.astro apps/web/src/pages/regulamin.astro apps/web/src/pages/rodo.astro
git commit -m "$(cat <<'EOF'
Restyle cart and legal pages to storefront chrome.

EOF
)"
```

---

### Task 7: Verify

**Files:** none new

- [ ] **Step 1: Unit tests + typecheck**

Run:

```bash
pnpm --filter @liteshop/web test
pnpm --filter @liteshop/web typecheck
```

Expected: all tests PASS; `astro check` exits 0.

- [ ] **Step 2: Browser**

With `pnpm dev` / `sst dev` as the repo already uses:

1. `/` — no Katalog eyebrow, 4:5 blocks, header `sklep` / `koszyk (0)`, footer `LiteShop` + lowercase legal.
2. Product — `sklep` back link, rectangular `Do koszyka`. After click, header shows `koszyk (1)` without reload of a second tab.
3. `/cart` — qty `− n +` rectangles; `Kasa` still opens Furgonetka init (sandbox script on the page).
4. Empty cart — no card frame; `do sklepu`.
5. `/kontakt` `/regulamin` `/rodo`.
6. Narrow viewport: same two header links, no `menu`.
7. `/admin` — still Figtree/Fraunces, moss active nav, pill-ish moss `shop-btn` (not ink rectangles).

- [ ] **Step 3: Commit only if Step 2 required extra fixes**

If no extra diffs, skip empty commit.
