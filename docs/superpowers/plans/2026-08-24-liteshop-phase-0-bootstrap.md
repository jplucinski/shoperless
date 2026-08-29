# LiteShop Phase 0 — Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Parent: [2026-08-24-liteshop-mvp.md](./2026-08-24-liteshop-mvp.md). Spec: [docs/prd.md](../../prd.md) §9–10, §42, §51. Technical ADRs already in repo: [0001](../../adr/0001-dynamodb-single-table.md), [0002](../../adr/0002-money-in-grosze.md), [0003](../../adr/0003-furgonetka-koszyk-inbound.md). Language: [docs/CONTEXT.md](../../CONTEXT.md).
>
> Do not start Phase 1 until this plan's gate passes.

**Goal:** Empty repo becomes a pnpm + SST v3 + Astro + Vitest monorepo that boots locally and has a smoke-tested `@liteshop/core` package.

**Architecture:** One SST app owns AWS resources. `apps/web` is the only deployable Astro runtime. Domain packages (`@liteshop/core`, later furgonetka/schema/renderer/ui) are libraries with ports; no AWS SDK in core tests. `shopId` exists on types from day 1 even though MVP seeds a single shop.

**Tech Stack:** Node 22, pnpm 9, TypeScript 5.6 strict, Astro 5, SST 3, Vitest 3, Zod 3, Prettier.

## Global Constraints

- LLM never generates stock/payment/auth/DynamoDB/inbound-handler/IAM/checkout code.
- LiteShop is source of truth for inventory; Furgonetka is source of truth for checkout, payments, shipping, invoices.
- `available` is not stored: `available = onHand - reserved`.
- Prices are integers in grosze, never float.
- Cart in `localStorage` is untrusted (only `sku` + `quantity`).
- Callbacks `ORDER_CREATED` / `PAYMENT_PAID` / `SHIPPING_CHANGED` are idempotent.
- LiteShop session is its own HttpOnly / Secure / SameSite cookie — not a Furgonetka token.
- MVP: one storefront, one inventory location, one Furgonetka connection, PLN / pl-PL, simple products.
- No custom checkout, payments, courier integrations, KSeF, ERP, Redis, Kubernetes, ECS.
- Package manager is **pnpm**. Test runner is **Vitest**. Infra is **SST v3**, not SST v2/CDK.
- Seed shop id is the string `shop_seed`. Clock and ids are injectable ports.

---

## File map

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.prettierrc.json
.gitignore
sst.config.ts
packages/core/package.json
packages/core/tsconfig.json
packages/core/vitest.config.ts
packages/core/src/index.ts
packages/core/src/clock.ts
packages/core/src/ids.ts
packages/core/src/money.ts
packages/core/src/errors.ts
packages/core/src/clock.test.ts
packages/core/src/money.test.ts
packages/furgonetka/package.json
packages/furgonetka/tsconfig.json
packages/furgonetka/src/index.ts
packages/ui/package.json
packages/ui/tsconfig.json
packages/ui/src/index.ts
apps/web/package.json
apps/web/astro.config.mjs
apps/web/tsconfig.json
apps/web/src/pages/index.astro
apps/web/src/pages/health.ts
docs/CONTEXT.md
docs/adr/0001-dynamodb-single-table.md
docs/adr/0002-money-in-grosze.md
docs/adr/0003-furgonetka-koszyk-inbound.md
```

`@liteshop/schema` and `@liteshop/renderer` are **not** created in Phase 0. They belong to Phase 2.

---

### Task 1: Root workspace and TypeScript baseline

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.prettierrc.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Interfaces:**
- Consumes: nothing (greenfield)
- Produces: workspace scripts `test`, `dev`, `build`; shared compiler options `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`

- [ ] **Step 1: Write root workspace files**

`package.json`:

```json
{
  "name": "liteshop",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "test": "pnpm -r --if-present test",
    "dev": "sst dev",
    "build": "pnpm -r --if-present build",
    "typecheck": "pnpm -r --if-present typecheck"
  },
  "devDependencies": {
    "prettier": "^3.4.2",
    "typescript": "^5.6.3"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 80
}
```

`.nvmrc`:

```text
22
```

`.gitignore`:

```text
node_modules
dist
.sst
.astro
.netlify
.DS_Store
*.log
.env
.env.*
!.env.example
coverage
```

- [ ] **Step 2: Install**

Run: `pnpm install`

Expected: lockfile `pnpm-lock.yaml` created; no packages besides prettier/typescript yet.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .prettierrc.json .gitignore .nvmrc
git commit -m "$(cat <<'EOF'
chore: initialize pnpm workspace and TypeScript baseline

EOF
)"
```

---

### Task 2: `@liteshop/core` package with Clock, ids, Money

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/clock.ts`
- Create: `packages/core/src/ids.ts`
- Create: `packages/core/src/money.ts`
- Create: `packages/core/src/errors.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/clock.test.ts`
- Test: `packages/core/src/money.test.ts`

**Interfaces:**
- Consumes: Task 1 workspace
- Produces:

```ts
export const SEED_SHOP_ID = "shop_seed";
export type ShopId = string;
export type ProductId = string;
export type Sku = string;
export type OrderId = string;
export type Money = number; // integer grosze; never float

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date;
}

export class FixedClock implements Clock {
  constructor(private readonly instant: Date);
  now(): Date;
}

export interface IdGenerator {
  productId(): ProductId;
  orderId(): OrderId;
  eventId(): string;
}

export class UlidGenerator implements IdGenerator {}

export function assertMoney(value: number): Money;
export function formatPln(grosze: Money): string;

export class DomainError extends Error {
  readonly code: string;
}
```

- [ ] **Step 1: Write failing tests**

`packages/core/src/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertMoney, formatPln } from "./money.ts";

describe("assertMoney", () => {
  it("accepts integer grosze", () => {
    expect(assertMoney(19900)).toBe(19900);
  });

  it("rejects floats", () => {
    expect(() => assertMoney(19.99)).toThrow(/grosze/);
  });

  it("rejects negatives", () => {
    expect(() => assertMoney(-1)).toThrow(/grosze/);
  });
});

describe("formatPln", () => {
  it("formats grosze as PLN", () => {
    expect(formatPln(19900)).toBe("199,00 zł");
    expect(formatPln(0)).toBe("0,00 zł");
    expect(formatPln(50)).toBe("0,50 zł");
  });
});
```

`packages/core/src/clock.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FixedClock } from "./clock.ts";

describe("FixedClock", () => {
  it("returns the injected instant", () => {
    const instant = new Date("2026-08-24T12:00:00.000Z");
    const clock = new FixedClock(instant);
    expect(clock.now().toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

`packages/core/package.json`:

```json
{
  "name": "@liteshop/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^3.0.5"
  },
  "dependencies": {
    "ulidx": "^2.4.1"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Run: `pnpm install && pnpm --filter @liteshop/core test`

Expected: FAIL — `Cannot find module './money.ts'` / `./clock.ts`.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/money.ts`:

```ts
export type Money = number;

export function assertMoney(value: number): Money {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("money must be non-negative integer grosze");
  }
  return value;
}

export function formatPln(grosze: Money): string {
  const whole = Math.floor(grosze / 100);
  const frac = String(grosze % 100).padStart(2, "0");
  return `${whole},${frac} zł`;
}
```

`packages/core/src/clock.ts`:

```ts
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return this.instant;
  }
}
```

`packages/core/src/ids.ts`:

```ts
import { ulid } from "ulidx";

export type ShopId = string;
export type ProductId = string;
export type Sku = string;
export type OrderId = string;

export const SEED_SHOP_ID: ShopId = "shop_seed";

export interface IdGenerator {
  productId(): ProductId;
  orderId(): OrderId;
  eventId(): string;
}

export class UlidGenerator implements IdGenerator {
  productId(): ProductId {
    return `prd_${ulid()}`;
  }
  orderId(): OrderId {
    return `ord_${ulid()}`;
  }
  eventId(): string {
    return `evt_${ulid()}`;
  }
}
```

`packages/core/src/errors.ts`:

```ts
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
```

`packages/core/src/index.ts`:

```ts
export { assertMoney, formatPln, type Money } from "./money.ts";
export { SystemClock, FixedClock, type Clock } from "./clock.ts";
export {
  SEED_SHOP_ID,
  UlidGenerator,
  type ShopId,
  type ProductId,
  type Sku,
  type OrderId,
  type IdGenerator,
} from "./ids.ts";
export { DomainError } from "./errors.ts";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @liteshop/core test`

Expected: PASS (4 tests in money + 1 in clock).

- [ ] **Step 5: Commit**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: add @liteshop/core with Clock, ids, and grosze Money

EOF
)"
```

---

### Task 3: Stub `@liteshop/furgonetka` and `@liteshop/ui`

**Files:**
- Create: `packages/furgonetka/package.json`
- Create: `packages/furgonetka/tsconfig.json`
- Create: `packages/furgonetka/src/index.ts`
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 1 workspace
- Produces: empty packages that export nothing yet so Phase 1 can add files without redoing workspace wiring

- [ ] **Step 1: Create stub packages**

`packages/furgonetka/package.json`:

```json
{
  "name": "@liteshop/furgonetka",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@liteshop/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

`packages/furgonetka/src/index.ts`:

```ts
export {};
```

`packages/ui/package.json`:

```json
{
  "name": "@liteshop/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

`packages/ui/src/index.ts`:

```ts
export {};
```

Copy `packages/core/tsconfig.json` into both packages (same `extends` / `rootDir` / `outDir` / `include`).

- [ ] **Step 2: Install workspace links**

Run: `pnpm install`

Expected: `@liteshop/furgonetka` depends on `@liteshop/core` via workspace protocol.

- [ ] **Step 3: Commit**

```bash
git add packages/furgonetka packages/ui pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: stub @liteshop/furgonetka and @liteshop/ui packages

EOF
)"
```

---

### Task 4: Astro app with health endpoint

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/astro.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/pages/index.astro`
- Create: `apps/web/src/pages/health.ts`
- Create: `apps/web/src/env.d.ts`

**Interfaces:**
- Consumes: `@liteshop/core` `SEED_SHOP_ID`
- Produces: `GET /health` → `{ ok: true, shopId: "shop_seed" }`; `GET /` renders a page containing the text `LiteShop`

- [ ] **Step 1: Scaffold Astro**

`apps/web/package.json`:

```json
{
  "name": "@liteshop/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check"
  },
  "dependencies": {
    "@liteshop/core": "workspace:*",
    "@liteshop/furgonetka": "workspace:*",
    "@liteshop/ui": "workspace:*",
    "astro": "^5.1.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

`apps/web/astro.config.mjs`:

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
});
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`apps/web/src/env.d.ts`:

```ts
/// <reference path="../.astro/types.d.ts" />
```

`apps/web/src/pages/health.ts`:

```ts
import type { APIRoute } from "astro";
import { SEED_SHOP_ID } from "@liteshop/core";

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: true, shopId: SEED_SHOP_ID }), {
    headers: { "content-type": "application/json" },
  });
```

`apps/web/src/pages/index.astro`:

```astro
---
import { SEED_SHOP_ID } from "@liteshop/core";
---
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>LiteShop</title>
  </head>
  <body>
    <h1>LiteShop</h1>
    <p>shop {SEED_SHOP_ID}</p>
  </body>
</html>
```

- [ ] **Step 2: Install and typecheck**

Run: `pnpm install && pnpm --filter @liteshop/web typecheck`

Expected: PASS (or Astro generates `.astro/types.d.ts` then PASS).

- [ ] **Step 3: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: add Astro web app with health endpoint

EOF
)"
```

---

### Task 5: SST v3 — Astro, DynamoDB, S3, Cron, Secret

**Files:**
- Create: `sst.config.ts`
- Modify: `apps/web/astro.config.mjs` (add `sst()` integration after `npx sst@latest init` if it injects one — keep `output: "server"`)
- Create: `.env.example`

**Interfaces:**
- Consumes: `apps/web` as the Astro path
- Produces: linked resources `Table`, `Images`, `ReservationExpiry`, `KoszykSharedKey` available via `Resource.*` in the Astro app after `sst dev`

- [ ] **Step 1: Write `sst.config.ts`**

```ts
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "liteshop",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { aws: { region: "eu-central-1" } },
    };
  },
  async run() {
    const koszykSharedKey = new sst.Secret("KoszykSharedKey");

    const table = new sst.aws.Dynamo("Table", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    const images = new sst.aws.Bucket("Images", {
      access: "public",
    });

    const web = new sst.aws.Astro("Web", {
      path: "apps/web",
      link: [table, images, koszykSharedKey],
    });

    new sst.aws.Cron("ReservationExpiry", {
      schedule: "rate(5 minutes)",
      job: {
        handler: "apps/web/src/jobs/release-expired-reservations.handler",
        link: [table],
      },
    });

    return {
      url: web.url,
    };
  },
});
```

`.env.example`:

```text
# sst secret set KoszykSharedKey "dev-only-not-for-production"
```

Create a placeholder handler so SST can typecheck the Cron (Phase 1.5 replaces this with real logic):

`apps/web/src/jobs/release-expired-reservations.ts`:

```ts
export async function handler() {
  return { released: 0 };
}
```

- [ ] **Step 2: Install SST and set the secret**

Run:

```bash
pnpm add -Dw sst
npx sst secret set KoszykSharedKey "dev-only-not-for-production"
```

Expected: SST writes `.sst/`; secret stored for current stage.

- [ ] **Step 3: Boot `sst dev` long enough to confirm Astro + health**

Run: `pnpm dev`

Expected: SST prints a URL. `curl -s $URL/health` returns `{"ok":true,"shopId":"shop_seed"}`. `curl -s $URL/` contains `LiteShop`.

Stop the process after that check. If AWS credentials are missing, fail the task — do not comment out resources.

- [ ] **Step 4: Commit**

Do **not** commit `.sst/` or secrets.

```bash
git add sst.config.ts .env.example apps/web/src/jobs/release-expired-reservations.ts apps/web/astro.config.mjs package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat: add SST Astro app with DynamoDB, S3, Cron, and Koszyk secret

EOF
)"
```

---

### Task 6: CONTEXT.md and ADRs already in repo

**Files (already committed — do not rewrite):**
- `docs/CONTEXT.md`
- `docs/adr/0001-dynamodb-single-table.md`
- `docs/adr/0002-money-in-grosze.md`
- `docs/adr/0003-furgonetka-koszyk-inbound.md`

**Interfaces:**
- Consumes: committed canon in those four files
- Produces: nothing new unless a file is missing from git

- [ ] **Step 1: Confirm the four files exist (do not paste a second glossary)**

The fenced blocks below are **read-only snapshots of the committed files**. If they differ from `docs/CONTEXT.md` / `docs/adr/*`, the files on disk win — update this plan, do not fork the glossary.
```md
# LiteShop

LiteShop is a small shop tool (catalog, inventory, cart, admin) that sells through Furgonetka. AI storefront generation is a later layer on top of a shop that already runs.

## Language

**Shop**:
A single merchant storefront with one inventory location and one Furgonetka connection.
_Avoid_: tenant, account, website

**Store Definition**:
A versioned presentation document (theme, pages, sections) that does not contain stock, prices, or orders.
_Avoid_: theme JSON, CMS page, layout

**Draft**:
The unpublished Store Definition currently being edited. Preview renders Draft.
_Avoid_: staging, unpublished theme

**Published**:
The Store Definition currently served on the live storefront.
_Avoid_: production theme, live JSON

**Product**:
A sellable item with sku, slug, name, images, price, and status. Stock is not part of Product.
_Avoid_: SKU (as the entity), variant, listing

**Inventory**:
On-hand and reserved quantity for one sku in one Shop. Available is derived: onHand minus reserved.
_Avoid_: stock record, warehouse, available (as a stored field)

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
Furgonetka's hosted checkout. Furgonetka calls LiteShop's inbound API after the customer completes it.
_Avoid_: LiteShop checkout, payment page

## Example dialogue

Dev: When the customer clicks checkout, do we create an Order?
Expert: No. We prepare a trusted cart snapshot and open Koszyk. An Order Mirror is created when Furgonetka posts the inbound order, and that is also when we take a Reservation.

Dev: After payment, do we decrease available?
Expert: We never store available. Payment confirmation decreases onHand and reserved together, once, idempotently.
```

- [ ] **Step 2: Write ADRs**

`docs/adr/0001-dynamodb-single-table.md`:

```md
# ADR-001: DynamoDB single-table design

## Status
Accepted

## Decision
One table `Table` with `pk` + `sk` and GSI `gsi1` (`gsi1pk` + `gsi1sk`). Keys:

- `SHOP#{shopId}` / `META`
- `SHOP#{shopId}` / `PRODUCT#{productId}`
- `SHOP#{shopId}` / `INVENTORY#{sku}`
- `SHOP#{shopId}` / `INVEVT#{eventId}`
- `SHOP#{shopId}` / `ORDER#{orderId}`
- `SHOP#{shopId}` / `EXTORDER#{externalOrderId}`
- `SHOP#{shopId}` / `RESERVATION#{orderId}`
- `SHOP#{shopId}` / `FURGONETKA`
- `SESSION#{sessionId}` / `META`
- later: `SHOP#{shopId}` / `STORE#DRAFT`, `STORE#VERSION#{n}`

GSI1:

- products by slug: `gsi1pk = SHOP#{shopId}#SLUG`, `gsi1sk = {slug}`
- reservations by expiry: `gsi1pk = SHOP#{shopId}#RESERVATION`, `gsi1sk = {expiresAtIso}`

## Consequences
All commerce items are shop-scoped. Core tests use in-memory ports; the Dynamo adapter is the only AWS SDK user.
```

`docs/adr/0002-money-in-grosze.md`:

```md
# ADR-002: Money is integer grosze

## Status
Accepted

## Decision
`Money` is a non-negative integer count of grosze. PLN 199.00 is `19900`. Formatting happens at the UI edge via `formatPln`.

## Consequences
JSON APIs send integers. Furgonetka adapter converts to/from whatever fractional units Koszyk uses, inside `@liteshop/furgonetka` only.
```

`docs/adr/0003-furgonetka-koszyk-inbound.md`:

```md
# ADR-003: Furgonetka Koszyk is inbound

## Status
Accepted

## Decision
LiteShop does not host checkout. The storefront loads `Furgonetka.Checkout` and supplies cart data from a server-prepared snapshot. Furgonetka then POSTs order and payment events to LiteShop endpoints authenticated with a shared key.

OAuth is a separate track for admin sign-in and "open in Furgonetka". It is not required to accept the first paid sandbox order.

Inbound URL paths and JSON schemas are copied from https://furgonetka.pl/api/koszyk into `@liteshop/furgonetka` during Phase 1 contract capture. They are not invented here.

## Consequences
`@liteshop/core` never imports Furgonetka types. The adapter maps captured payloads onto `CreateOrderCommand` and `ApplyPaymentCommand`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/CONTEXT.md docs/adr
git commit -m "$(cat <<'EOF'
docs: add domain glossary and bootstrap ADRs

EOF
)"
```

---

## Phase 0 gate

All of the following must be true before Phase 1:

- `pnpm test` passes (`@liteshop/core` money + clock tests)
- `pnpm --filter @liteshop/web typecheck` passes
- `sst dev` serves `GET /health` → `{"ok":true,"shopId":"shop_seed"}`
- `docs/CONTEXT.md` and ADRs 0001–0003 exist (already in repo; Task 6 is verify-only)

Next: [2026-08-24-liteshop-phase-1-commerce-proof.md](./2026-08-24-liteshop-phase-1-commerce-proof.md)
