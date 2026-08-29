# LiteShop Phase 2 — Store Definition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Parent: [2026-08-24-liteshop-mvp.md](./2026-08-24-liteshop-mvp.md). Depends on Phase 1 gate (sandbox paid order). Spec: [docs/prd.md](../../prd.md) §11–12, §15, §38, §40–41.
>
> Do not start Phase 3 until two different Store Definitions render without touching commerce code.

**Goal:** Multiple visually different storefronts are produced entirely from a validated Store Definition, with draft/preview/publish/rollback and no LLM.

**Architecture:** `@liteshop/schema` is the only place section types exist. `@liteshop/renderer` maps a validated definition onto Astro section components. `@liteshop/core` gains a store-version repository (draft + published pointer + last 10 published versions). Commerce APIs from Phase 1 stay unchanged. `apps/web` home page stops being hardcoded and renders `pages.home.sections`.

**Tech Stack:** Zod 3 in `@liteshop/schema`, Astro components in `@liteshop/renderer`, same SST app. Custom domain via `sst.aws.Astro` `domain` once a shop setting is stored — until then preview is `{origin}/preview` behind the admin session ([ADR-004](../../adr/0004-preview-renders-draft.md)).

## Global Constraints

Inherited from Phase 0/1, plus:

- Store Definition controls presentation, never stock, prices, or orders.
- Unknown `section.type` fails validation and must not reach the renderer.
- AI is forbidden in this phase. Fixtures are checked-in JSON.
- Publish failure leaves the previous published version active.
- Retain at least 10 previous published versions.
- Preview renders Draft; the live storefront renders Published.
- Locale `pl-PL`, currency `PLN` only in MVP; schema still types them as literals so more can be added later.

---

## File map

```text
packages/schema/package.json
packages/schema/tsconfig.json
packages/schema/vitest.config.ts
packages/schema/src/theme.ts
packages/schema/src/sections.ts
packages/schema/src/store-definition.ts
packages/schema/src/validate.ts
packages/schema/src/index.ts
packages/schema/src/validate.test.ts
packages/schema/src/fixtures/spacious-home.json
packages/schema/src/fixtures/compact-home.json
packages/renderer/package.json
packages/renderer/tsconfig.json
packages/renderer/src/sections/Hero.astro
packages/renderer/src/sections/ProductGrid.astro
packages/renderer/src/sections/FeaturedProduct.astro
packages/renderer/src/sections/SplitStory.astro
packages/renderer/src/sections/TextSection.astro
packages/renderer/src/sections/ImageSection.astro
packages/renderer/src/sections/Gallery.astro
packages/renderer/src/sections/Testimonials.astro
packages/renderer/src/sections/Faq.astro
packages/renderer/src/sections/Newsletter.astro
packages/renderer/src/sections/LogoCloud.astro
packages/renderer/src/sections/Spacer.astro
packages/renderer/src/Storefront.astro
packages/renderer/src/render-sections.ts
packages/core/src/store/store-version.ts
packages/core/src/store/store-repository.ts
packages/core/src/store/memory-store-repository.ts
packages/core/src/store/store-service.ts
packages/core/src/store/store-service.test.ts
apps/web/src/pages/index.astro
apps/web/src/pages/preview/index.astro
apps/web/src/pages/admin/store.astro
apps/web/src/pages/api/admin/store/publish.ts
apps/web/src/pages/api/admin/store/rollback.ts
```

---

### Task 1: Zod Store Definition and section registry

**Files:**
- Create: all `packages/schema/**` listed above except fixtures used in Task 1 tests
- Test: `packages/schema/src/validate.test.ts`

**Interfaces:**
- Consumes: nothing from core commerce
- Produces:

```ts
export const storeDefinitionSchema: ZodType<StoreDefinition>;
export function parseStoreDefinition(input: unknown): StoreDefinition;
export type SectionType =
  | "hero"
  | "product-grid"
  | "featured-product"
  | "split-story"
  | "text"
  | "image"
  | "gallery"
  | "testimonials"
  | "faq"
  | "newsletter"
  | "logo-cloud"
  | "spacer";

export interface StoreDefinition {
  version: 1;
  store: {
    name: string;
    locale: "pl-PL";
    currency: "PLN";
  };
  theme: {
    density: "compact" | "spacious";
    radius: "none" | "small" | "large";
  };
  pages: {
    home: { sections: Section[] };
  };
}

export type Section =
  | { type: "hero"; props: { heading: string; image: string; size?: "small" | "medium" | "large" } }
  | { type: "product-grid"; props: { collection: string; columns: 2 | 3 | 4 } }
  | { type: "featured-product"; props: { sku: string; heading?: string } }
  | { type: "split-story"; props: { image: string; heading: string; text: string } }
  | { type: "text"; props: { heading?: string; body: string } }
  | { type: "image"; props: { src: string; alt: string } }
  | { type: "gallery"; props: { images: { src: string; alt: string }[] } }
  | { type: "testimonials"; props: { items: { quote: string; author: string }[] } }
  | { type: "faq"; props: { items: { question: string; answer: string }[] } }
  | { type: "newsletter"; props: { heading: string; text?: string } }
  | { type: "logo-cloud"; props: { logos: { src: string; alt: string }[] } }
  | { type: "spacer"; props: { size: "s" | "m" | "l" } };
```

`parseStoreDefinition` uses a Zod `discriminatedUnion("type", ...)` for sections. `.strict()` on props objects so unknown prop keys fail. A section `{ type: "magic-hero", props: {} }` fails with a message containing `Invalid discriminator value`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseStoreDefinition } from "./validate.ts";
import spacious from "./fixtures/spacious-home.json";

describe("parseStoreDefinition", () => {
  it("accepts the spacious fixture", () => {
    const def = parseStoreDefinition(spacious);
    expect(def.store.name).toBe("Juneheart");
    expect(def.pages.home.sections[0]?.type).toBe("hero");
  });

  it("rejects unknown section types", () => {
    expect(() =>
      parseStoreDefinition({
        version: 1,
        store: { name: "X", locale: "pl-PL", currency: "PLN" },
        theme: { density: "spacious", radius: "small" },
        pages: {
          home: { sections: [{ type: "magic-hero", props: {} }] },
        },
      }),
    ).toThrow(/Invalid discriminator value|magic-hero/);
  });

  it("rejects a product-grid with 5 columns", () => {
    expect(() =>
      parseStoreDefinition({
        version: 1,
        store: { name: "X", locale: "pl-PL", currency: "PLN" },
        theme: { density: "compact", radius: "none" },
        pages: {
          home: {
            sections: [
              { type: "product-grid", props: { collection: "all", columns: 5 } },
            ],
          },
        },
      }),
    ).toThrow();
  });
});
```

`packages/schema/src/fixtures/spacious-home.json`:

```json
{
  "version": 1,
  "store": { "name": "Juneheart", "locale": "pl-PL", "currency": "PLN" },
  "theme": { "density": "spacious", "radius": "small" },
  "pages": {
    "home": {
      "sections": [
        {
          "type": "hero",
          "props": {
            "heading": "Miękkość, którą zapamiętasz",
            "image": "/hero.jpg",
            "size": "large"
          }
        },
        {
          "type": "product-grid",
          "props": { "collection": "towels", "columns": 3 }
        },
        {
          "type": "split-story",
          "props": {
            "image": "/story.jpg",
            "heading": "Designed in Poland",
            "text": "Projektujemy przedmioty do codziennych rytuałów."
          }
        }
      ]
    }
  }
}
```

`packages/schema/src/fixtures/compact-home.json` — same store name, `density: "compact"`, `radius: "none"`, home sections: `text` then `product-grid` columns 2 (no hero). This fixture is used in Task 3 determinism tests.

Scaffold `@liteshop/schema` like `@liteshop/core` (vitest, `"exports": { ".": "./src/index.ts" }`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @liteshop/schema test`

Expected: FAIL missing module.

- [ ] **Step 3: Implement Zod schemas**

`sections.ts` — one `z.object({ type: z.literal("hero"), props: z.object({ heading: z.string().min(1), image: z.string().min(1), size: z.enum(["small","medium","large"]).optional() }).strict() })` per type, then `z.discriminatedUnion("type", [...])`.

`store-definition.ts` — `z.object({ version: z.literal(1), store: ..., theme: ..., pages: z.object({ home: z.object({ sections: z.array(sectionSchema).min(1) }) }) }).strict()`.

`validate.ts`:

```ts
export function parseStoreDefinition(input: unknown): StoreDefinition {
  return storeDefinitionSchema.parse(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @liteshop/schema test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/schema pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "$(cat <<'EOF'
feat: add StoreDefinition schema with a closed section registry

EOF
)"
```

Add `"packages/*"` already covers the new package.

---

### Task 2: Draft / published store versions in core

**Files:**
- Create: `packages/core/src/store/store-version.ts`
- Create: `packages/core/src/store/store-repository.ts`
- Create: `packages/core/src/store/memory-store-repository.ts`
- Create: `packages/core/src/store/store-service.ts`
- Test: `packages/core/src/store/store-service.test.ts`
- Modify: `packages/core/package.json` add `"@liteshop/schema": "workspace:*"`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `parseStoreDefinition`, `StoreDefinition`, `ShopId`, `Clock`
- Produces:

```ts
export interface StoreVersionRecord {
  shopId: ShopId;
  version: number;
  definition: StoreDefinition;
  createdAt: Date;
}

export interface StoreState {
  shopId: ShopId;
  draft: StoreDefinition;
  draftVersion: number;
  published: StoreDefinition | undefined;
  publishedVersion: number | undefined;
}

export interface StoreRepository {
  getState(shopId: ShopId): Promise<StoreState | undefined>;
  saveDraft(shopId: ShopId, definition: StoreDefinition, version: number): Promise<void>;
  savePublished(shopId: ShopId, record: StoreVersionRecord): Promise<void>;
  listPublished(shopId: ShopId): Promise<StoreVersionRecord[]>;
  getPublished(shopId: ShopId, version: number): Promise<StoreVersionRecord | undefined>;
  setPublishedPointer(shopId: ShopId, version: number, definition: StoreDefinition): Promise<void>;
}

export class StoreService {
  constructor(deps: { stores: StoreRepository; clock: Clock });
  putDraft(shopId: ShopId, input: unknown): Promise<StoreState>;
  getDraft(shopId: ShopId): Promise<StoreDefinition>;
  getPublished(shopId: ShopId): Promise<StoreDefinition>;
  publish(shopId: ShopId): Promise<StoreVersionRecord>;
  rollback(shopId: ShopId, version: number): Promise<StoreVersionRecord>;
}

export class NothingToPublishError extends DomainError // code: "NOTHING_TO_PUBLISH"
export class StoreVersionNotFoundError extends DomainError // code: "STORE_VERSION_NOT_FOUND"
```

Retention: after `publish`, if `listPublished` length > 11 (current + 10 previous), delete the oldest published item. Keep the published pointer. Implement `deletePublished(shopId, version)` on the repo.

Publish must call `parseStoreDefinition` again. If parse throws, do not change the published pointer.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { FixedClock } from "../clock.ts";
import spacious from "@liteshop/schema/src/fixtures/spacious-home.json";
import compact from "@liteshop/schema/src/fixtures/compact-home.json";
import { MemoryStoreRepository } from "./memory-store-repository.ts";
import { StoreService } from "./store-service.ts";

const shopId = "shop_seed";

function service() {
  return new StoreService({
    stores: new MemoryStoreRepository(),
    clock: new FixedClock(new Date("2026-08-24T12:00:00.000Z")),
  });
}

describe("StoreService", () => {
  it("publishes draft without mutating it when a later draft is invalid", async () => {
    const stores = service();
    await stores.putDraft(shopId, spacious);
    const published = await stores.publish(shopId);
    expect(published.version).toBe(1);
    await stores.putDraft(shopId, compact);
    expect(() =>
      stores.putDraft(shopId, { version: 1, pages: {} }),
    ).toThrow();
    const live = await stores.getPublished(shopId);
    expect(live.theme.density).toBe("spacious");
  });

  it("rolls back to a previous published version", async () => {
    const stores = service();
    await stores.putDraft(shopId, spacious);
    await stores.publish(shopId);
    await stores.putDraft(shopId, compact);
    await stores.publish(shopId);
    const rolled = await stores.rollback(shopId, 1);
    expect(rolled.version).toBe(1);
    expect((await stores.getPublished(shopId)).theme.density).toBe("spacious");
  });

  it("keeps only 10 previous published versions plus current", async () => {
    const stores = service();
    for (let i = 0; i < 12; i += 1) {
      const def = {
        ...spacious,
        store: { ...spacious.store, name: `Shop ${i}` },
      };
      await stores.putDraft(shopId, def);
      await stores.publish(shopId);
    }
    const listed = await stores.listPublishedForTest?.(shopId);
    // expose listPublished on the service for this assertion:
    // expect((await repo.listPublished(shopId)).length).toBeLessThanOrEqual(11)
  });
});
```

Rewrite the third test without optional chaining — inject the same `MemoryStoreRepository` instance:

```ts
it("keeps at most 11 published records", async () => {
  const repo = new MemoryStoreRepository();
  const stores = new StoreService({
    stores: repo,
    clock: new FixedClock(new Date("2026-08-24T12:00:00.000Z")),
  });
  for (let i = 0; i < 12; i += 1) {
    await stores.putDraft(shopId, {
      ...spacious,
      store: { ...spacious.store, name: `Shop ${i}` },
    });
    await stores.publish(shopId);
  }
  expect((await repo.listPublished(shopId)).length).toBeLessThanOrEqual(11);
});
```

If `resolveJsonModule` is painful, import fixtures via `readFileSync` + `JSON.parse` from `../../schema/src/fixtures/spacious-home.json` using `fs` and `import.meta.url`.

- [ ] **Step 2: Run to fail, implement, run to pass**

`putDraft` parses then increments `draftVersion`. `publish` copies current draft to a new published version number (`max(published versions)+1` or `draftVersion`), sets pointer. `rollback(version)` loads that record, sets pointer to it, and copies it into draft so the merchant can edit from the rolled-back definition.

Dynamo keys (ADR-001): `STORE#DRAFT`, `STORE#VERSION#{n}`, `STORE#PUBLISHED` pointer item `{ version }`.

- [ ] **Step 3: Commit**

```bash
git add packages/core packages/schema
git commit -m "$(cat <<'EOF'
feat: add draft/publish/rollback for Store Definition versions

EOF
)"
```

---

### Task 3: Deterministic renderer

**Files:**
- Create: `packages/renderer/**` section components and `Storefront.astro`
- Create: `packages/renderer/src/render-sections.ts`
- Test: `packages/renderer/src/render-sections.test.ts`
- Modify: `apps/web/package.json` depend on `@liteshop/schema` and `@liteshop/renderer`
- Modify: `apps/web/src/pages/index.astro` to render published definition
- Create: `apps/web/src/pages/preview/index.astro` to render draft (admin-session required)

**Interfaces:**
- Consumes: `StoreDefinition`, `Product[]` from `ProductService.listActive` for `product-grid` / `featured-product`
- Produces:

```ts
export function sectionTestId(section: Section, index: number): string;
// `${index}-${section.type}`

export function themeClassNames(theme: StoreDefinition["theme"]): string;
// density-spacious radius-small etc.
```

Each section component is a pure Astro file reading `Astro.props` typed as that section's `props`. `Storefront.astro`:

```astro
---
import type { StoreDefinition } from "@liteshop/schema";
import type { Product } from "@liteshop/core";
import Hero from "./sections/Hero.astro";
// ...all twelve
interface Props {
  definition: StoreDefinition;
  products: Product[];
}
const { definition, products } = Astro.props;
---
<main class={themeClassNames(definition.theme)} data-store={definition.store.name}>
  {definition.pages.home.sections.map((section, index) => (
    <section data-section={sectionTestId(section, index)}>
      {section.type === "hero" && <Hero {...section.props} />}
      {section.type === "product-grid" && (
        <ProductGrid {...section.props} products={products} />
      )}
      {/* one branch per SectionType — no default that swallows unknown types; exhaustive check */}
    </section>
  ))}
</main>
```

Because unknown types cannot exist after `parseStoreDefinition`, the switch is exhaustive. Add `function assertNever(x: never): never` if TypeScript flags a missing branch.

`render-sections.test.ts` does **not** need a browser. It asserts `themeClassNames` and `sectionTestId` plus that both fixtures parse. Markup determinism: add `packages/renderer/src/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { themeClassNames, sectionTestId } from "./render-sections.ts";

it("is stable for spacious/small", () => {
  expect(themeClassNames({ density: "spacious", radius: "small" })).toBe(
    "density-spacious radius-small",
  );
});

it("labels the first hero as 0-hero", () => {
  expect(sectionTestId({ type: "hero", props: { heading: "h", image: "/x" } }, 0)).toBe(
    "0-hero",
  );
});
```

`ProductGrid.astro` renders `products` (Phase 1 catalog). Ignore `collection` for MVP except putting it on `data-collection={collection}` — filtering collections is out of scope (PRD §51 simple catalog).

`index.astro` (live): `StoreService.getPublished`; if none, render the Phase 1 heading `LiteShop` and a note `sklep nieopublikowany` (do not crash).

`preview/index.astro`: require admin session; `getDraft`; same `Storefront`.

- [ ] **Step 1: Write theme/sectionId tests, fail, implement, pass**

- [ ] **Step 2: Wire index + preview; add `@liteshop/ui` Tailwind classes for density/radius in `apps/web/src/styles/storefront.css`:**

```css
.density-spacious { --section-gap: 4rem; }
.density-compact { --section-gap: 1.5rem; }
.radius-none :is(img, button) { border-radius: 0; }
.radius-small :is(img, button) { border-radius: 0.25rem; }
.radius-large :is(img, button) { border-radius: 1rem; }
main { display: flex; flex-direction: column; gap: var(--section-gap); }
```

- [ ] **Step 3: Browser-check** — putDraft+publish spacious fixture, `/` shows hero heading `Miękkość, którą zapamiętasz`. putDraft compact, `/` still spacious, `/preview` shows compact (no hero).

- [ ] **Step 4: Commit**

```bash
git add packages/renderer apps/web packages/schema
git commit -m "$(cat <<'EOF'
feat: render storefronts deterministically from Store Definition

EOF
)"
```

---

### Task 4: Admin store settings, publish, rollback, domain field

**Files:**
- Create: `apps/web/src/pages/admin/store.astro`
- Create: `apps/web/src/pages/api/admin/store/draft.ts`
- Create: `apps/web/src/pages/api/admin/store/publish.ts`
- Create: `apps/web/src/pages/api/admin/store/rollback.ts`
- Modify: `packages/core/src/store/store-service.ts` to persist settings
- Modify: `sst.config.ts` only if a production domain is already known — otherwise store the domain string on shop META and do not call AWS until an operator sets `sst.aws.Astro({ domain })` per stage

**Interfaces:**
- Consumes: `StoreService`, shop META
- Produces: settings fields from PRD §38: store name (from definition `store.name`), domain string, locale, currency, Furgonetka connection status (read-only from Phase 1 connection item), publish status (`draftVersion` vs `publishedVersion`).

`POST /api/admin/store/draft` body = unknown JSON → `putDraft`. `POST /api/admin/store/publish` → `publish`. `POST /api/admin/store/rollback` body `{ version: number }` → `rollback`.

Admin page lists published versions 1..n with rollback buttons. Preview link `/preview`.

Shop META item: `{ domain?: string }`. `PUT /api/admin/store/settings` `{ domain: string }` saves it. Custom hostname wiring is an ops change to `sst.config.ts` (`domain: { name: settings.domain }`). Preview URL is already decided in [ADR-004](../../adr/0004-preview-renders-draft.md) — do not write a second ADR.

- [ ] **Step 1: Admin routes + page (ADR-004 already exists)**

- [ ] **Step 2: Browser-check publish and rollback from `/admin/store`**

- [ ] **Step 3: Commit**

```bash
git add apps/web packages/core sst.config.ts
git commit -m "$(cat <<'EOF'
feat: add store admin for draft publish rollback and domain setting

EOF
)"
```

---

## Phase 2 gate

- `pnpm --filter @liteshop/schema test` passes (unknown type rejected).
- Two fixtures (spacious vs compact) produce different `data-section` sequences on preview vs live as described in Task 3 Step 3.
- Rollback restores the previous published hero.
- Failed `putDraft` with invalid JSON leaves published HTML unchanged.
- Phase 1 sandbox purchase still works (cart → Koszyk) on the rendered storefront.

Next: [2026-08-24-liteshop-phase-3-ai-generation.md](./2026-08-24-liteshop-phase-3-ai-generation.md)
