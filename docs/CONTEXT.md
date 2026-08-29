# LiteShop

LiteShop is a small shop tool (catalog, inventory, cart, admin) that sells through Furgonetka. AI storefront generation is a later layer on top of a shop that already runs.

This file is the **language canon**. PRD is product. `docs/adr/` is technical decision log. Phase plans must not introduce a second name for anything defined here.

## Layout

```text
apps/web              @liteshop/web     Astro storefront + admin + API
packages/core         @liteshop/core    commerce domain (ports + in-memory)
packages/furgonetka   @liteshop/furgonetka  Koszyk + OAuth only
packages/schema       @liteshop/schema  Store Definition (Phase 2)
packages/renderer     @liteshop/renderer  definition → Astro (Phase 2)
packages/ui           @liteshop/ui      shared islands
```

Seed shop id: `shop_seed`. Fixture store name: `Juneheart`. Locale `pl-PL`, currency `PLN`.

## Language

**Shop**:
A single merchant storefront with one inventory location and one Furgonetka connection.
_Avoid_: tenant, account, website

**Store Definition**:
A versioned presentation document (`version`, `store`, `theme`, `pages.home.sections`) that does not contain stock, prices, or orders. Section `type` values are kebab-case from PRD §12.
_Avoid_: theme JSON, CMS page, layout

**Draft**:
The unpublished Store Definition currently being edited. Preview renders Draft at `{origin}/preview` behind the admin session.
_Avoid_: staging, unpublished theme, `preview-{shop}` subdomain (post-MVP)

**Published**:
The Store Definition currently served on the live storefront (`/`).
_Avoid_: production theme, live JSON

**Product**:
A sellable item with sku, slug, name, images, price, and status. Stock is not part of Product. MVP has no variants.
_Avoid_: SKU (as the entity), variant, listing

**Inventory**:
On-hand and reserved quantity for one sku in one Shop. Field names: `onHand`, `reserved`. Available is derived: `onHand - reserved`. Never stored.
_Avoid_: stock record, warehouse, `available` as a stored field, `onHand` as a second name

**Reservation**:
A time-bounded hold of quantity for one Order Mirror. Expires unless payment is confirmed.
_Avoid_: lock, allocation, hold (as a stored available field)

**Order Mirror**:
LiteShop's minimal copy of a Furgonetka order: items, totals, payment status, shipping status. Not the post-order backoffice.
_Avoid_: Order (unqualified), checkout, transaction

**Cart**:
A client-side list of sku plus quantity. Never authoritative for price or availability.
_Avoid_: basket, session cart (as a server entity)

**Koszyk**:
Furgonetka's hosted checkout. After the customer completes it, Furgonetka POSTs to LiteShop's **inbound** shop API (shared key). LiteShop does not expose a checkout webhook of its own.
_Avoid_: LiteShop checkout, payment page, outbound LiteShop webhook

**Inbound event**:
Authenticated POST from Furgonetka into LiteShop (`ORDER_CREATED`, `PAYMENT_PAID`, `SHIPPING_CHANGED`). Idempotent.
_Avoid_: webhook (unless quoting Furgonetka docs)

## Inventory events

`DELIVERY | ADJUSTMENT | RESERVATION | SALE | RESERVATION_RELEASED`

`DAMAGED` is a reason string on `ADJUSTMENT`, not its own event type.

## Example dialogue

Dev: When the customer clicks checkout, do we create an Order?
Expert: No. We prepare a trusted cart snapshot and open Koszyk. An Order Mirror is created when Furgonetka posts the inbound order, and that is also when we take a Reservation.

Dev: After payment, do we decrease available?
Expert: We never store available. Payment confirmation decreases onHand and reserved together, once, idempotently.

Dev: Is preview `preview-{shop}.liteshop.dev`?
Expert: Not in MVP. Preview is `{origin}/preview` behind the admin session. Wildcard DNS is post-MVP.
