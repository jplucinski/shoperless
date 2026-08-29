# LiteShop PRD

## 1. Product overview

**Product name:** LiteShop  
**Category:** Lightweight commerce shop / later AI storefront generator  
**Primary market:** Small and medium Polish e-commerce brands using or willing to use Furgonetka  
**Status:** MVP definition  
**Language:** [CONTEXT.md](CONTEXT.md) · **Technical ADRs:** [docs/adr/](adr/)

LiteShop is a small shop tool: catalog, inventory, cart, admin, and a storefront that sells through Furgonetka Koszyk.

A merchant can go live **without** the generator: add products, set stock and prices, connect Furgonetka, publish. That path is the product.

AI generation comes **after** the shop works. Later, the merchant may describe a look:

> „Minimalistyczny sklep z ręcznikami premium. Jasne kolory, dużo przestrzeni, duże zdjęcia produktów, styl Zara Home.”

LiteShop then produces a validated Store Definition and renders it with Astro. Invalid AI output must not touch commerce state.

LiteShop deliberately does **not** implement a complete commerce ecosystem.

Commerce responsibilities are split between:

- **LiteShop** — storefront, products, inventory, cart, minimal order mirror, administration; later AI generation of presentation.
- **Furgonetka** — checkout, payments, customer delivery data, shipping methods, parcel lockers, shipment handling, tracking, invoices and related post-purchase operations.

Core principle:

> **LiteShop Core runs the store. Furgonetka handles checkout and fulfillment. The LLM, when used, only designs presentation.**

---

# 2. Problem

Launching even a small online store usually requires configuring multiple systems:

- storefront,
- CMS,
- product catalog,
- checkout,
- payments,
- delivery providers,
- parcel lockers,
- invoices,
- tracking,
- hosting,
- administration.

Platforms such as Shopify and WooCommerce solve this by becoming the complete commerce platform.

This creates significant complexity for merchants who only need:

1. a good-looking storefront,
2. several products,
3. stock management,
4. checkout,
5. payments,
6. shipping.

At the same time, AI website generators can produce attractive websites but typically stop before solving actual commerce operations.

LiteShop aims to bridge these two worlds.

---

# 3. Product vision

A merchant should be able to go from:

> „I want to sell these products.”

to:

> „My store is live.”

without configuring a traditional e-commerce platform.

Target onboarding (shop first):

```text
Create shop
      ↓
Add products, prices, stock
      ↓
Connect Furgonetka
      ↓
Publish
      ↓
Sell
```

Optional, later:

```text
Describe look
      ↓
Generate / patch Store Definition
      ↓
Preview
      ↓
Publish presentation
```

The long-term product vision is:

> **A small shop that actually sells, with commerce infrastructure delegated — and an optional AI layer that designs the storefront after the shop already runs.**

---

# 4. Goals

## MVP goals

LiteShop must allow a merchant to:

1. maintain a small product catalog,
2. manage physical inventory,
3. connect a Furgonetka account,
4. allow customers to complete checkout through Furgonetka Koszyk,
5. receive order and payment information,
6. view basic order information,
7. publish the store under a production domain,
8. present the storefront from a Store Definition (preview, publish, rollback) — without AI,
9. later: create a look from an AI prompt,
10. later: modify the look through natural-language instructions.

The merchant must not need:

- Shopify,
- WooCommerce,
- a standalone CMS,
- a payment integration,
- a courier integration,
- an invoice module.

---

# 5. Non-goals

LiteShop MVP will **not** implement:

- a custom payment gateway,
- a custom checkout form,
- custom parcel-locker selection,
- courier integrations,
- invoice generation,
- KSeF implementation,
- ERP functionality,
- advanced CRM,
- marketing automation,
- marketplace integrations,
- warehouse management system,
- accounting,
- advanced discount engines,
- loyalty programmes,
- multi-warehouse inventory,
- complex RBAC,
- custom plugins.

These features may be reconsidered only when validated by actual merchant demand.

---

# 6. Target user

## Primary persona — small brand owner

Characteristics:

- 5–100 products,
- low to moderate order volume,
- primarily Polish customers,
- limited technical knowledge,
- wants a professional independent storefront,
- does not want to administer WordPress,
- already uses or can adopt Furgonetka.

Examples:

- handmade products,
- clothing,
- home accessories,
- cosmetics,
- candles,
- ceramics,
- small D2C brands.

---

# 7. Product principles

## 7.1 Keep commerce core small

LiteShop must resist becoming Shopify.

Before implementing a commerce feature, the team should ask:

> Can Furgonetka or another specialized provider already handle this?

If yes, LiteShop should integrate rather than reimplement.

---

## 7.2 LLM generates configuration, not commerce code

LLM must never generate:

- stock algorithms,
- payment code,
- authentication code,
- DynamoDB expressions,
- Furgonetka inbound handlers,
- IAM permissions,
- checkout logic.

Instead:

```text
Prompt
  ↓
LLM
  ↓
StoreDefinition
  ↓
validation
  ↓
deterministic renderer
```

---

## 7.3 Generated stores must remain deterministic

The same valid Store Definition must always result in a valid storefront.

AI output must therefore conform to a strict schema.

---

## 7.4 Preview before publish

AI must never directly modify production.

All AI changes use:

```text
Draft
  ↓
Preview
  ↓
Publish
```

---

# 8. High-level architecture

```text
                         LiteShop Studio
                               │
                         prompt / editor
                               │
                               ▼
                              LLM
                               │
                               ▼
                       Store Definition
                               │
                             validate
                               │
                               ▼
                       Astro Renderer
                               │
                               ▼
                       Published Store
                               │
            ┌──────────────────┼─────────────────┐
            │                  │                 │
         Catalog              Cart             Admin
            │                  │                 │
            └────────────┬─────┴───────┬────────┘
                         │             │
                         ▼             ▼
                    LiteShop Core   Furgonetka
                         │             │
                         ▼             ├─ checkout
                      DynamoDB         ├─ payments
                                       ├─ shipping
                                       ├─ tracking
                                       └─ invoices
```

---

# 9. Technology architecture

## Frontend

**Astro**

Responsibilities:

- storefront rendering,
- product pages,
- content pages,
- cart UI,
- administration UI,
- server endpoints where appropriate.

Most public pages should be statically rendered or aggressively cached.

Dynamic pages include:

- administration,
- inventory,
- order views,
- API endpoints.

---

## Infrastructure

**SST + AWS**

Initial infrastructure:

```text
CloudFront
Astro runtime
DynamoDB
S3
Secrets
scheduled jobs where required
```

The architecture should remain serverless where practical.

The MVP should not require:

- Kubernetes,
- ECS,
- Redis,
- persistent application servers.

---

# 10. Core modules

Logical packages:

```text
@liteshop/core
@liteshop/schema
@liteshop/renderer
@liteshop/furgonetka
@liteshop/ui
```

## `@liteshop/core`

Contains:

- product domain,
- inventory domain,
- order domain,
- cart validation,
- reservations,
- sessions,
- publish lifecycle.

## `@liteshop/schema`

Contains:

- StoreDefinition schema,
- section definitions,
- theme definitions,
- version migrations.

## `@liteshop/renderer`

Maps StoreDefinition to tested Astro components.

## `@liteshop/furgonetka`

Contains the entire Furgonetka integration.

The LLM has no access to implementation details of this package.

---

# 11. Store Definition

The Store Definition is the central abstraction of LiteShop.

Conceptually:

```yaml
version: 1

store:
  name: Juneheart
  locale: pl-PL
  currency: PLN

theme:
  density: spacious
  radius: small

pages:
  home:
    sections:
      - type: hero
        props:
          heading: Miękkość, którą zapamiętasz
          image: /hero.jpg

      - type: product-grid
        props:
          collection: towels
          columns: 3
```

The Store Definition controls presentation, not commerce state.

---

# 12. Component registry

AI may only use predefined sections.

Initial component library:

- Hero
- Product Grid
- Featured Product
- Split Story
- Text Section
- Image Section
- Gallery
- Testimonials
- FAQ
- Newsletter
- Logo Cloud
- Spacer

Example:

```yaml
- type: split-story
  props:
    image: /story.jpg
    heading: Designed in Poland
    text: Projektujemy przedmioty do codziennych rytuałów.
```

Unknown component types fail validation.

---

# 13. AI store generation

## First generation

User provides:

- business type,
- product category,
- brand description,
- preferred aesthetic,
- optional existing website,
- optional brand colours,
- optional inspiration.

Example:

> Minimalistyczny sklep z ceramiką. Styl japoński, ciepły, spokojny. Produkty mają dominować nad tekstem.

LLM produces a valid Store Definition.

---

## Generation pipeline

```text
User prompt
     ↓
Intent extraction
     ↓
Design generation
     ↓
Structured StoreDefinition
     ↓
Schema validation
     ↓
Business validation
     ↓
Preview
```

Invalid generations must not reach the renderer.

---

# 14. AI editing

After generation, the merchant can say:

> Hero jest za duży. Przesuń produkty wyżej i usuń połowę tekstu.

The system should modify the existing draft rather than regenerate the entire store.

Preferred mechanism:

```text
Current StoreDefinition
        +
User instruction
        ↓
LLM
        ↓
structured patch
```

Example conceptual patch:

```yaml
operations:
  - op: replace
    path: pages.home.sections.0.props.size
    value: medium

  - op: move
    from: pages.home.sections.1
    to: pages.home.sections.0
```

---

# 15. Draft and publish model

Each shop has at minimum:

```text
DRAFT
PUBLISHED
```

Flow:

```text
Published v12
      │
      └── AI edit
             ↓
          Draft v13
             ↓
           Preview
             ↓
           Publish
             ↓
        Published v13
```

Older versions should remain available for rollback.

MVP requirement:

- retain at least 10 previous published versions.

---

# 16. Products

Products are separate from Store Definition.

Core product model:

```text
Product
├── id
├── sku
├── slug
├── name
├── description
├── images
├── price
├── status
└── metadata
```

LLM may assist with:

- description,
- short description,
- SEO title,
- SEO description,
- alt text,
- product naming.

LLM may not invent operational values such as:

- SKU,
- inventory,
- tax values,
- actual price,
- physical dimensions,
- weight.

Those values require explicit merchant input.

---

# 17. Inventory

LiteShop is the source of truth for inventory.

Inventory model:

```text
sku
onHand
reserved
```

Derived:

```text
available = onHand - reserved
```

Do not store `available` separately.

---

# 18. Inventory reservation

When an order reserves stock:

```text
reserved += quantity
```

The write must succeed only when:

```text
onHand - reserved >= requestedQuantity
```

DynamoDB conditional writes or transactions must guarantee that two concurrent purchases cannot oversell the same inventory.

---

# 19. Successful payment

Once the associated payment is confirmed:

```text
onHand   -= quantity
reserved -= quantity
```

The transition must be idempotent.

Repeated Furgonetka callbacks must not decrement inventory repeatedly.

---

# 20. Failed or expired transaction

If an unpaid reservation expires:

```text
reserved -= quantity
```

Reservations require an expiry mechanism.

MVP target:

- reservation TTL: configurable,
- default approximately 20 minutes.

A scheduled job may release expired reservations.

---

# 21. Inventory administration

Admin screen:

```text
MAGAZYN

Blue Towel

Na stanie       100
Zarezerwowane     4
Dostępne          96

[ Dodaj dostawę ]
[ Korekta ]
[ Historia ]
```

Supported operations:

### Delivery

```text
+50
reason = DELIVERY
```

### Adjustment

```text
-2
reason = DAMAGED
event type = ADJUSTMENT
```

All manual inventory changes should generate an inventory event.

---

# 22. Inventory history

Store immutable inventory events:

```text
24.08  +50 DELIVERY
24.08   -2 ADJUSTMENT (DAMAGED)
23.08   -1 SALE #1041
23.08   +1 RESERVATION_RELEASED #1040
```

This provides basic auditability without implementing a full warehouse system.

---

# 23. Cart

The anonymous cart may remain client-side.

Example:

```json
{
  "items": [
    {
      "sku": "TOWEL-BLUE",
      "quantity": 2
    }
  ]
}
```

Storage:

```text
localStorage
```

The browser must not be trusted for:

- price,
- availability,
- product status.

Before checkout LiteShop validates the cart server-side.

---

# 24. Furgonetka integration

Furgonetka is treated as an external commerce provider.

LiteShop owns a stable integration layer:

```text
@liteshop/furgonetka
```

The storefront generator does not know how Furgonetka works internally.

---

# 25. Connect Furgonetka

Admin:

```text
Integracje

Furgonetka
Niepołączona

[ Połącz Furgonetkę ]
```

OAuth flow:

```text
LiteShop
   ↓
Furgonetka authorize
   ↓
merchant login
   ↓
consent
   ↓
callback
   ↓
authorization code
   ↓
tokens
```

LiteShop stores:

- Furgonetka account identifier,
- encrypted refresh token,
- connection status,
- connection timestamp.

Sensitive credentials must never be exposed to browser code.

---

# 26. Furgonetka authentication for LiteShop Admin

Where supported by the integration, LiteShop may use the Furgonetka OAuth relationship as the basis for admin authentication.

Flow:

```text
/admin
   ↓
Sign in with Furgonetka
   ↓
OAuth
   ↓
LiteShop validates authorised account
   ↓
LiteShop creates its own session
```

Furgonetka tokens must not become the LiteShop browser session.

LiteShop issues its own:

```text
HttpOnly
Secure
SameSite
```

session cookie.

---

# 27. Furgonetka Koszyk

Customer flow:

```text
Product
   ↓
Add to cart
   ↓
LiteShop Cart
   ↓
Checkout
   ↓
Furgonetka Koszyk
```

Furgonetka handles the checkout experience.

LiteShop provides trustworthy cart data.

---

# 28. Checkout validation

Before passing information to Furgonetka, LiteShop resolves:

```text
SKU
↓
current Product
+
current Price
+
current Inventory
```

The client may submit:

```json
{
  "sku": "TOWEL-BLUE",
  "quantity": 2
}
```

It must never submit authoritative:

```text
price
payment status
stock
total
```

---

# 29. Order creation

When Furgonetka informs LiteShop about a newly created order (inbound Koszyk API, shared key — not a LiteShop-hosted webhook):

```text
Furgonetka
     ↓
LiteShop inbound API
     ↓
validate
     ↓
deduplicate
     ↓
create order
     ↓
reserve inventory
```

Order creation and stock reservation should ideally be transactional.

---

# 30. Order model

LiteShop keeps a minimal order mirror.

Example:

```json
{
  "id": "1042",
  "externalOrderId": "...",
  "status": "CREATED",
  "paymentStatus": "PENDING",
  "shippingStatus": "NOT_SHIPPED",
  "items": [
    {
      "sku": "TOWEL-BLUE",
      "quantity": 2,
      "unitPrice": 19900
    }
  ],
  "total": 39800
}
```

LiteShop does not attempt to become the full post-order backoffice.

---

# 31. Payment status

Furgonetka inbound payment event:

```text
Furgonetka
     ↓
inbound payment POST
     ↓
Furgonetka adapter
     ↓
LiteShop PaymentStatus
```

Internal statuses:

```text
PENDING
PAID
FAILED
CANCELLED
```

External provider-specific status names must remain inside the Furgonetka adapter.

---

# 32. Shipping status

LiteShop stores enough shipping information for merchant visibility.

Example:

```json
{
  "shipping": {
    "status": "IN_TRANSIT",
    "trackingNumber": "...",
    "updatedAt": "..."
  }
}
```

Detailed shipment operations remain in Furgonetka.

---

# 33. Invoices

LiteShop does **not** implement invoicing.

Merchant workflow:

```text
LiteShop Order
      ↓
Open in Furgonetka
      ↓
invoice / KSeF / documents
```

Admin may display:

```text
[ Otwórz w Furgonetce ]
```

This avoids implementing:

- invoice numbering,
- VAT accounting,
- PDF generation,
- corrections,
- KSeF,
- document delivery.

---

# 34. LiteShop Admin

The admin is intentionally small.

Navigation:

```text
Dashboard
Orders
Inventory
Products
Store
AI Designer
```

The admin must not evolve into an ERP.

---

# 35. Dashboard

Initial dashboard:

```text
Dzisiaj

12 zamówień
7 do realizacji
2 nieopłacone

Niski stan

Blue Towel       4
Candle           2

[ Zamówienia ]
[ Magazyn ]
```

---

# 36. Orders

Order list:

```text
#1042   PAID      IN_TRANSIT    399 zł
#1041   PENDING                 199 zł
#1040   PAID      DELIVERED     597 zł
```

Order detail:

```text
Order #1042

Payment
PAID

Shipping
IN_TRANSIT

2 × Blue Towel
1 × Candle

Total
399 PLN

[ Open in Furgonetka ]
```

---

# 37. Products

Product editor should contain only necessary operational and content fields.

Example:

```text
Name
Slug
SKU
Price
Images
Description
Active
```

Stock is managed separately.

AI actions:

```text
[ Generate description ]
[ Improve SEO ]
[ Generate alt text ]
```

---

# 38. Store settings

Store settings:

```text
Store name
Domain
Locale
Currency
Furgonetka connection
Publish status
```

MVP initially supports:

```text
PLN
pl-PL
```

Architecture should not prevent additional locales/currencies later.

---

# 39. AI Designer

Primary interaction:

```text
┌──────────────────────────────────────────────┐
│ Jak chcesz zmienić sklep?                   │
│                                              │
│ "Zrób homepage bardziej premium, usuń       │
│ zaokrąglenia i pokaż produkty wyżej."       │
│                                              │
│                           [ Generate ]       │
└──────────────────────────────────────────────┘
```

Generated changes always modify draft state.

---

# 40. Preview

The merchant must have a stable way to see Draft without changing Published.

MVP (see [ADR-004](adr/0004-preview-renders-draft.md)):

```text
{storeUrl}/preview
```

behind the admin session. Preview renders Draft. Production `/` renders Published.

A `preview-{shop}` subdomain is post-MVP (wildcard DNS after the first real merchant domain).

---

# 41. Publishing

Publish action:

```text
Draft v18
   ↓
validation
   ↓
publish
   ↓
Published v18
   ↓
cache invalidation
```

Publishing should not require rebuilding the complete application for simple Store Definition changes.

---

# 42. Data model

Initial DynamoDB **entities** (physical keys: [ADR-001](adr/0001-dynamodb-single-table.md)):

```text
SHOP
PRODUCT
INVENTORY
INVENTORY_EVENT
ORDER
EXTERNAL_ORDER (idempotency)
RESERVATION
FURGONETKA_CONNECTION
SESSION
STORE_DRAFT
STORE_VERSION
```

Conceptual example (ids are opaque; `BLUE` below is not a sku-as-productId):

```text
SHOP#{shopId} / META
SHOP#{shopId} / PRODUCT#{productId}
SHOP#{shopId} / INVENTORY#{sku}
SHOP#{shopId} / ORDER#{orderId}
SHOP#{shopId} / STORE#DRAFT
SHOP#{shopId} / STORE#VERSION#18
SHOP#{shopId} / FURGONETKA
```

---

# 43. Security requirements

MVP must enforce:

- HTTPS everywhere,
- HttpOnly session cookies,
- Secure cookies,
- CSRF protection where necessary,
- server-side cart validation,
- inbound API authentication (shared key),
- idempotent callbacks,
- encrypted external tokens,
- least-privilege AWS IAM,
- no AWS credentials in frontend,
- no Furgonetka secrets in frontend,
- input validation through schemas.

---

# 44. Idempotency

External callbacks may be delivered more than once.

Therefore:

```text
ORDER_CREATED
PAYMENT_PAID
SHIPPING_CHANGED
```

must be idempotent.

Example:

```text
PAID callback #1 → process
PAID callback #2 → no-op
PAID callback #3 → no-op
```

Inventory must never be decremented repeatedly because of duplicate callbacks.

---

# 45. Observability

MVP requires structured logging around:

- order creation,
- payment callbacks,
- stock reservations,
- reservation releases,
- Furgonetka API calls,
- failed AI generations,
- publishing.

Critical events should include:

```text
shopId
orderId
externalOrderId
sku
operation
correlationId
```

Never log authentication secrets or payment credentials.

---

# 46. Failure scenarios

The system must explicitly handle:

### Furgonetka unavailable

Customer receives retriable checkout error.

No inventory mutation unless an order/reservation has actually been created.

### Payment callback delayed

Order remains:

```text
PENDING
```

until callback or reconciliation.

### Duplicate order callback

No duplicate order or stock reservation.

### Inventory unavailable

Checkout must fail gracefully before overselling.

### LLM returns invalid definition

Reject generation and retain previous draft.

### Publish fails

Previously published version remains active.

---

# 47. Reconciliation

Even with inbound callbacks, LiteShop should eventually support periodic reconciliation for critical state.

Examples:

```text
PENDING orders older than X
unknown payment state
shipment without recent update
expired reservations
```

MVP requires reservation reconciliation.

Payment/shipping reconciliation can follow after validating available Furgonetka APIs.

---

# 48. MVP user journey

## Merchant

```text
1. Create LiteShop
2. Add products
3. Enter prices and stock
4. Connect Furgonetka
5. Publish
6. Sell

Later, optional:
7. Describe desired look
8. AI generates draft Store Definition
9. Preview
10. Edit with AI
11. Publish presentation
```

## Customer

```text
1. Visit store
2. Browse products
3. Add product to cart
4. Start checkout
5. Complete Furgonetka Koszyk
6. Select payment
7. Select delivery
8. Pay
9. Receive confirmation/tracking through configured flow
```

---

# 49. MVP acceptance criteria

The **shop tool** is complete when a new merchant can:

- add at least 10 products,
- upload product images,
- define prices,
- define inventory,
- connect Furgonetka,
- publish under a domain,
- place a real test order,
- complete payment,
- receive the order callback,
- update payment state,
- reserve and decrement inventory correctly,
- inspect the order from LiteShop Admin,
- manage stock through delivery and correction actions,
- open the related operation in Furgonetka.

**Presentation** (after the shop sells) is complete when they can drive look from a Store Definition: preview draft, publish, roll back a design version — still without AI.

The **generator** (later) is complete when they can:

- generate a storefront look from one prompt,
- change that look with another prompt,
- keep commerce state untouched when generation is invalid.

---

# 50. MVP success metrics

Primary metrics:

### Activation

Percentage of new users who reach:

```text
Store created → Furgonetka connected → storefront published
```

### Time to first sale

Target:

> Merchant should be able to list a product and complete a test purchase in one onboarding session.

### AI generation success

Percentage of generated Store Definitions passing validation without manual correction.

Initial target:

> >95%

### Publish success

Target:

> >99.5% successful publishing operations.

### Commerce correctness

Target:

> Zero confirmed overselling caused by LiteShop stock concurrency bugs.

### Merchant admin complexity

Target:

> A new merchant can find order status and adjust inventory without documentation.

---

# 51. Explicit product constraints

LiteShop must remain opinionated.

MVP supports:

```text
one storefront
one inventory location
one primary Furgonetka connection
simple products (no variants)
one currency
small catalogs
```

Avoid prematurely supporting every commerce edge case.

---

# 52. Roadmap

## Phase 1 — Commerce proof

- Astro storefront
- SST infrastructure
- products
- cart
- DynamoDB inventory
- Furgonetka Koszyk
- order callback
- payment callback
- basic admin

Success criterion:

> A real product can be bought end-to-end.

---

## Phase 2 — Store Definition

- schema
- component registry
- deterministic renderer
- draft/published lifecycle
- preview
- rollback

No AI required yet.

Success criterion:

> Multiple visually different stores can be produced entirely from Store Definition.

---

## Phase 3 — AI storefront generation

- prompt → StoreDefinition
- structured output
- AI editing
- patch-based updates
- content generation
- preview workflow

Success criterion:

> Non-technical merchant can create a credible storefront without editing YAML.

---

## Phase 4 — Operational AI

Potential capabilities:

- „Które produkty mają niski stock?”
- „Pokaż nieopłacone zamówienia.”
- „Czy są jakieś problematyczne przesyłki?”
- „Dodaj sekcję promocji letniej.”
- „Przenieś bestseller na początek strony.”

Actions must remain permissioned and explicit.

---

# 53. Key architecture decisions

Product decisions (stable). Numbered technical ADRs live in `docs/adr/` and **do not** reuse these labels.

## PD-1

**Use Furgonetka instead of building checkout, payment and shipping infrastructure.**
Technical: [ADR-003](adr/0003-furgonetka-koszyk-inbound.md).

## PD-2

**Use Astro as both storefront renderer and lightweight server runtime.**

## PD-3

**Use SST/AWS serverless infrastructure.**

## PD-4

**Use DynamoDB as primary operational datastore.**
Technical: [ADR-001](adr/0001-dynamodb-single-table.md).

## PD-5

**LiteShop owns inventory.** Money is integer grosze: [ADR-002](adr/0002-money-in-grosze.md).

## PD-6

**LLM is optional and late.** It generates StoreDefinition only, never business-critical application code. The shop must sell without it.

## PD-7

**UI is produced from a predefined component registry.**

## PD-8

**Draft and published storefront states are separate.**
Preview: [ADR-004](adr/0004-preview-renders-draft.md).

## PD-9

**Furgonetka remains the detailed post-order backoffice; LiteShop keeps only the operational mirror it needs.**

---

# 54. Product moat

LiteShop should not compete by having more commerce functionality than Shopify.

Its advantage is the opposite:

```text
Traditional ecommerce platform

Storefront
CMS
Commerce engine
Checkout
Payments
Shipping
Invoices
Admin
Plugins
Integrations
        ↓
huge platform
```

LiteShop:

```text
tiny LiteShop Core  (catalog, inventory, cart, order mirror)
 ↓
Astro storefront    (from Store Definition, with or without AI)
 ↓
Furgonetka          (checkout, payments, shipping, invoices)

optional, later:
AI → StoreDefinition → same renderer, never into Core
```

The merchant gets a shop that sells, without carrying a full commerce platform. Unique look is optional acceleration, not the foundation.

---

# 55. Product statement

> **LiteShop is a small shop: catalog, stock, and a storefront that sells through Furgonetka. After the shop runs, an optional generator can design the look from natural language — it never writes commerce code.**

Short version:

> **Sell. Then, optionally, generate the look.**

Technical rule that should remain true throughout development:

> **LLM generates data, not commerce code.**