# LiteShop

Lightweight shop for small Polish brands that already use (or will use) Furgonetka. Catalog, inventory, cart, admin, storefront — checkout and fulfillment stay with [Koszyk](https://furgonetka.pl/api/koszyk).

A merchant goes live **without** an AI generator: products, stock, prices, Furgonetka, publish. That path is the product. AI comes later and only designs presentation. Invalid AI output must not touch commerce state.

> **LiteShop Core runs the store. Furgonetka handles checkout and fulfillment. The LLM, when used, only designs presentation.**

Full PRD: [docs/prd.md](docs/prd.md). Language: [docs/CONTEXT.md](docs/CONTEXT.md). ADRs: [docs/adr/](docs/adr/).

## Problem

Shopify/Woo cover the whole stack. A small brand usually needs a storefront, a few products, stock, checkout, pay, ship — not a platform. AI site generators stop before commerce. LiteShop is the gap.

## Vision

```text
Create shop → products, prices, stock → connect Furgonetka → publish → sell
```

Later, optional: describe look → Store Definition → preview → publish presentation.

Long-term: a small shop that actually sells, with commerce delegated, and an optional AI layer after the shop already runs.

## Who

Small brand owner: 5–100 products, mostly PL, wants an independent storefront, will not run WordPress, can live on Furgonetka (handmade, clothing, home, cosmetics, D2C).

## MVP

Merchant can: catalog, physical inventory, Furgonetka, Koszyk checkout, inbound order/payment, inspect the Order Mirror, publish on a domain. Store Definition (preview / publish / rollback) is after the shop sells, still without AI. Prompt-to-look is later.

Must not need Shopify, Woo, a CMS, a payment integration, a courier integration, or an invoice module.

**Not in MVP:** custom checkout/payments/lockers, courier APIs, invoices/KSeF, ERP/CRM, marketing, marketplaces, WMS, accounting, discounts, loyalty, multi-warehouse, RBAC, plugins.

**Constraints:** one storefront, one inventory location, one Furgonetka connection, no variants, one currency, small catalogs.

**Shop-tool done when:** ≥10 products, images, prices, stock, Furgonetka connected, domain, a real paid test order, inbound payment, inventory reserved then decremented once, admin can inspect and open the case in Furgonetka.

**Customer:** visit → browse → cart → Koszyk (pay + delivery) → confirmation/tracking via Furgonetka.

## Principles

- Before adding a commerce feature: can Furgonetka already do it? If yes, integrate.
- LLM never generates stock, payment, auth, Dynamo, inbound, IAM, or checkout code — only Store Definition and copy.
- Generated stores stay deterministic: same definition → same storefront.
- Preview draft before publish ([ADR-004](docs/adr/0004-preview-renders-draft.md)).

## Roadmap

| Phase | What | Done when |
| --- | --- | --- |
| 1 Commerce proof | Astro, SST, products, cart, Dynamo inventory, Koszyk, inbound, admin | A real product can be bought end-to-end |
| 2 Store Definition | schema, renderer, draft/published, preview, rollback | Visually different stores from definition only |
| 3 AI storefront | prompt → definition, patches, preview | Non-technical merchant, no YAML |
| 4 Operational AI | stock/orders questions, explicit mutations | Permissioned actions only |

Now: Phase 1.

## Layout

```text
apps/web              Astro storefront + admin + API
packages/core         commerce domain (grosze, Dynamo ports)
packages/furgonetka   Koszyk types, inbound parse, OAuth
packages/schema       Store Definition (Phase 2)
packages/renderer     definition → Astro (Phase 2)
packages/ui           shared islands
```

pnpm workspace. SST v3 (`eu-central-1`). Node `>=22`. Money is integer grosze ([ADR-002](docs/adr/0002-money-in-grosze.md)).

Seed shop: `shop_seed`. Locale `pl-PL`, `PLN`.

## Run

```bash
pnpm install
npx sst secret set KoszykSharedKey "<shared-key>"
npx sst secret set KoszykCheckoutUuid "<uuid-from-koszyk-panel>"
npx sst secret set AdminPassword "<admin-password>"
npx sst secret set FurgonetkaClientId "<oauth-client-id>"
npx sst secret set FurgonetkaClientSecret "<oauth-client-secret>"
npx sst secret set TokenEncryptionKey "<32+ byte key>"
pnpm dev
```

`pnpm dev` is `sst dev`. Needs AWS credentials.

Then seed inventory (DEV only):

```bash
curl -X POST "$URL/api/dev/seed"
```

- Storefront `/`, cart `/cart`, admin `/admin/login`
- Tests: `pnpm test`

`KOSZYK_ENV` is `prod` only when `$app.stage === "production"`; otherwise the sandbox checkout script.

Without a checkout UUID the cart still works; the Koszyk button is not mounted.

## Koszyk

Inbound shop API base: `{origin}/api/furgonetka` ([ADR-003](docs/adr/0003-furgonetka-koszyk-inbound.md)). Header: `Authorization` (raw token or `Bearer …`) = `KoszykSharedKey`.

| Method | Path |
| --- | --- |
| GET, POST | `/orders` |
| POST | `/orders/{sourceOrderId}/payments` |
| POST | `/orders/{sourceOrderId}/tracking_number` |

Fixtures: `packages/furgonetka/src/fixtures/`. Contract: [OpenAPI](https://furgonetka.pl/js/swagger/universal-integration-structure-documentation.yaml).

`sourceOrderId` is LiteShop’s Order Mirror id (`ord_…`). Idempotency on create uses Furgonetka `cartId`.
