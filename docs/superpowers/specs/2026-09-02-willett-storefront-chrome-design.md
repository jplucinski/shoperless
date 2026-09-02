# Willett-like storefront chrome

Date: 2026-09-02  
Reference: [willettspace.com](https://willettspace.com/) (visual system only)  
Scope: LiteShop customer storefront chrome. Not a clone of Willett content, photography, wordmark, or Unica 77.

## Goal

Restyle the existing catalog / PDP / cart / legal pages so they read as Willett Space: Swiss grotesque, off-white field, dark-brown ink, lowercase header, rectangular controls. Keep current page structure and Furgonetka checkout. Do not rebuild home as an editorial photo essay. Do not add a cart overlay.

## Decisions

| Topic | Choice |
|---|---|
| Fidelity | Chrome: tokens, header/footer, buttons, card chrome. Layout of catalog/PDP/cart stays. |
| Header | Nav left, `koszyk (n)` right, no wordmark in the bar. |
| Footer wordmark | `LiteShop` |
| Implementation | Tokens in `global.css` + `ShopLayout` + restyle existing pages. |
| Cart | Remains `/cart`. Header count is a link, not a drawer. |
| Font | Schibsted Grotesk 500/700 via Google Fonts. Not Unica 77 (Lineto licence). |
| Admin | Unchanged (`AdminLayout` and admin pages). |
| Copy language | Polish labels, lowercase in chrome (`sklep`, `koszyk (n)`, `regulamin`, `rodo`, `kontakt`). |

## Visual tokens

Replace the boutique theme in `apps/web/src/styles/global.css`.

| Token | Value | Replaces |
|---|---|---|
| `--font-sans` | `"Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif` | Figtree |
| `--font-display` | same as sans (no second family) | Fraunces |
| `--color-linen` | `#f6f4eb` | `#f3eee4` |
| `--color-paper` | `#fbfaee` | `#fffaf3` |
| `--color-ink` | `#241500` | `#1a1614` |
| `--color-mute` | `color-mix(in srgb, var(--color-ink) 55%, var(--color-linen))` | `#6b6258` |
| `--color-line` | `color-mix(in srgb, var(--color-ink) 18%, var(--color-linen))` | `#d9d0c3` |
| `--color-mark` | `#6f140e` | moss / moss-dark (CTA hover / focus only) |

Body: `background: var(--color-linen)`, `color: var(--color-ink)`, `font-family: var(--font-sans)`, `font-weight: 500`.

Radius: product/legal/cart chrome uses `0` (no `rounded-2xl` / `rounded-3xl` / pill). Quantity control and `shop-btn` are rectangles with hairline or fill.

`shop-btn`: fill `--color-ink`, text `--color-paper`, no border-radius, padding ~`0.75rem 1.25rem`, weight 700. Hover: `--color-mark`.  
`shop-btn-ghost`: transparent, hairline `--color-ink`, hover fill `--color-paper`.

Placeholder product “image” keeps the existing gradient block (no photography in this shop) but loses rounded corners. Aspect ratio on catalog thumbs: `4 / 5`.

## Header

`ShopLayout` header is `fixed`, full width, no border, no backdrop blur, no logo.

- Left: `<a href="/">sklep</a>`, `font-bold`, lowercase, `text-ink`, no underline. No distinct “active” colour.
- Right: React island `CartCount` (`client:load`): link to `/cart`, label `koszyk (${n})` where `n` is the sum of quantities in `liteshop.cart`. Empty cart shows `koszyk (0)`.
- Same two items at mobile and desktop. Do **not** add a `menu` toggle: with a single nav item it would only hide `sklep`.
- `main` (and footer) clear the fixed header with top padding (~`4.5rem` desktop, similar mobile).

`CartCount` must update in the same tab when the cart changes. `storage` events do not fire in the same document. `writeCart` in `cart-storage.ts` dispatches a window event (e.g. `liteshop:cart`) after persist; `CartCount` listens to that plus `storage` for other tabs.

## Footer

- Large wordmark: text `LiteShop`, link `/`, grotesk bold, not Willett’s SVG.
- Legal row: `regulamin` · `rodo` · `kontakt`, lowercase, `--color-mute`, no extra “LiteShop” caption.
- Generous top padding (~`8–12rem`). No top border.

## Pages

### Home (`index.astro`)

Keep 1 / 2 column product list and Dynamo empty/error copy.

Remove: eyebrow `Katalog`, Fraunces headline `Rzeczy do domu, bez szumu.`, card border/shadow/hover-lift/rounded.

Each product: 4:5 placeholder, then name + `formatPln` price. Link still `/products/${slug}`.

### PDP (`products/[slug].astro`)

Keep two-column article. Square-off placeholder and type. `CartButton` uses `shop-btn`. Back link: lowercase `sklep` (not `← Sklep`).

### Cart (`CartView.tsx`)

Keep line list + summary + `CheckoutButton` → Furgonetka `init`.

Remove rounded layout shell, pill quantity, display serif headings. Quantity: `−` / number / `+` with hairline. Empty state: centred type + `do sklepu` as `shop-btn` link, no framed card.

Continue-shopping link: lowercase `sklep`.

### Legal (`kontakt`, `regulamin`, `rodo`)

Inherit tokens via layout. Drop framed/rounded info boxes; keep content.

## Files (expected)

- `apps/web/src/styles/global.css` — tokens + `shop-*` + cart layout radius
- `apps/web/src/layouts/ShopLayout.astro` — fonts, header, footer, main offset
- `apps/web/src/islands/CartCount.tsx` — new
- `apps/web/src/islands/cart-storage.ts` — cart event
- `apps/web/src/pages/index.astro`
- `apps/web/src/pages/products/[slug].astro`
- `apps/web/src/islands/CartView.tsx`
- `apps/web/src/islands/CartButton.tsx` — only if classes need a tweak
- `apps/web/src/pages/kontakt.astro`, `regulamin.astro`, `rodo.astro`

Do not change admin layouts/pages or Furgonetka prepare/checkout behaviour.

## Out of scope

- Editorial home (sticky labels, 12-col photo stack, huge in-page wordmark)
- Cart overlay / removing `/cart`
- Licensed Unica 77
- Willett photography, logo, product copy
- New routes (`spatial`, `showroom`, `catalogue`, `about`, `custom`)
- Admin UI
- Store Definition / renderer theme (Phase 2)

## Verification

- Storefront routes: `/`, `/products/{slug}`, `/cart` (empty and with lines), `/kontakt`, `/regulamin`, `/rodo`
- Header count matches cart after add/remove/qty in the same tab
- Checkout button still calls prepare + `Furgonetka.Checkout.init`
- `/admin` still uses the old admin chrome
- Desktop and a narrow viewport
