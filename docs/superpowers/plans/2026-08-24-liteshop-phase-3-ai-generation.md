# LiteShop Phase 3 — AI Storefront Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Parent: [2026-08-24-liteshop-mvp.md](./2026-08-24-liteshop-mvp.md). Depends on Phase 2 gate. Spec: [docs/prd.md](../../prd.md) §13–14, §37 AI actions, §39, §46 invalid LLM, §49.
>
> Phase 4 (operational AI over orders/stock) is out of scope.

**Goal:** A non-technical merchant creates and edits a credible storefront with natural-language prompts; invalid model output never overwrites draft or published.

**Architecture:** A `StoreGenerationProvider` port lives in `@liteshop/schema` consumers (`packages/core/src/ai` or a thin `packages/ai` if core must not import AWS). Prefer `packages/core` port + `apps/web` Bedrock adapter so `@liteshop/core` still has no AWS SDK. The provider returns **data** (`StoreDefinition` or `StorePatch`). `parseStoreDefinition` / `applyStorePatch` run before `StoreService.putDraft`. The model never sees inventory, orders, DynamoDB, or `@liteshop/furgonetka`.

**Tech Stack:** Amazon Bedrock (Qwen or the current project default) via a provider interface; structured JSON output; Vitest with a `FakeStoreGenerationProvider`.

## Global Constraints

Inherited from earlier phases, plus:

- LLM generates Store Definition and product copy, never commerce code.
- LLM must not invent SKU, inventory, tax, price, dimensions, or weight.
- Invalid generation retains the previous draft.
- AI edits patch the current draft; they do not regenerate the whole store unless the merchant explicitly asks for a full regenerate (separate button that still validates).
- Published is never written by AI — only `putDraft`. Merchant still clicks Publish (Phase 2).
- Prompt logging may store `shopId` + `correlationId`; never API keys.

---

## File map

```text
packages/core/src/ai/store-patch.ts
packages/core/src/ai/store-patch.test.ts
packages/core/src/ai/generation-provider.ts
packages/core/src/ai/generate-store.ts
packages/core/src/ai/generate-store.test.ts
packages/core/src/ai/product-copy.ts
packages/core/src/ai/product-copy.test.ts
apps/web/src/lib/bedrock-store-generation.ts
apps/web/src/pages/admin/designer.astro
apps/web/src/pages/api/admin/ai/generate.ts
apps/web/src/pages/api/admin/ai/edit.ts
apps/web/src/pages/api/admin/ai/product-copy.ts
apps/web/src/islands/AiDesigner.tsx
```

---

### Task 1: Structured Store Patch

**Files:**
- Create: `packages/core/src/ai/store-patch.ts`
- Test: `packages/core/src/ai/store-patch.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `StoreDefinition`, `parseStoreDefinition` from `@liteshop/schema`
- Produces:

```ts
export type StorePatchOp =
  | { op: "replace"; path: JsonPointer; value: unknown }
  | { op: "remove"; path: JsonPointer }
  | { op: "move"; from: JsonPointer; to: JsonPointer }
  | { op: "add"; path: JsonPointer; value: unknown };

export interface StorePatch {
  operations: StorePatchOp[];
}

export function applyStorePatch(
  current: StoreDefinition,
  patch: StorePatch,
): StoreDefinition;
```

`JsonPointer` is a string matching `/^\/(store|theme|pages)(\/[^/]+)*$/` plus the PRD examples `pages.home.sections.0.props.size` — support **dot+index paths** as in the PRD, not RFC6901, to match merchant-facing examples:

```ts
export function parseDotPath(path: string): Array<string | number>;
// "pages.home.sections.0.props.size" → ["pages","home","sections",0,"props","size"]
```

`applyStorePatch` clones `current` (structuredClone), applies ops in order, then `parseStoreDefinition` on the result. If parse fails, throw `DomainError("INVALID_STORE_PATCH", ...)` and do not return the clone.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseStoreDefinition } from "@liteshop/schema";
import spacious from "../../../schema/src/fixtures/spacious-home.json" with { type: "json" };
import { applyStorePatch } from "./store-patch.ts";

describe("applyStorePatch", () => {
  it("replaces hero size and moves product-grid before hero", () => {
    const current = parseStoreDefinition(spacious);
    const next = applyStorePatch(current, {
      operations: [
        { op: "replace", path: "pages.home.sections.0.props.size", value: "medium" },
        {
          op: "move",
          from: "pages.home.sections.1",
          to: "pages.home.sections.0",
        },
      ],
    });
    expect(next.pages.home.sections[0]?.type).toBe("product-grid");
    expect(next.pages.home.sections[1]?.type).toBe("hero");
    if (next.pages.home.sections[1]?.type === "hero") {
      expect(next.pages.home.sections[1].props.size).toBe("medium");
    }
  });

  it("rejects a patch that introduces an unknown section type", () => {
    const current = parseStoreDefinition(spacious);
    expect(() =>
      applyStorePatch(current, {
        operations: [
          {
            op: "replace",
            path: "pages.home.sections.0.type",
            value: "magic-hero",
          },
        ],
      }),
    ).toMatchObject?.({});
    expect(() =>
      applyStorePatch(current, {
        operations: [
          {
            op: "replace",
            path: "pages.home.sections.0.type",
            value: "magic-hero",
          },
        ],
      }),
    ).toThrow(/INVALID_STORE_PATCH|magic-hero|discriminator/i);
  });
});
```

Fix the test: one `expect(() => apply...).toThrow(...)`. Do not use `toMatchObject` on a throw.

`move`: remove at `from`, insert at `to` (array indices like Array.splice). After moving index 1 to 0, former 0 shifts right.

- [ ] **Step 2: Run to fail**

Run: `pnpm --filter @liteshop/core test src/ai/store-patch.test.ts`

Expected: FAIL missing module.

- [ ] **Step 3: Implement clone + path get/set/remove + parseStoreDefinition**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: apply structured Store Definition patches then re-validate

EOF
)"
```

---

### Task 2: Generation use-case with fake provider

**Files:**
- Create: `packages/core/src/ai/generation-provider.ts`
- Create: `packages/core/src/ai/generate-store.ts`
- Test: `packages/core/src/ai/generate-store.test.ts`

**Interfaces:**
- Consumes: `StoreService.putDraft`, `parseStoreDefinition`, `applyStorePatch`
- Produces:

```ts
export interface GenerateStoreInput {
  businessType: string;
  productCategory: string;
  brandDescription: string;
  aesthetic: string;
  existingWebsite?: string;
  brandColours?: string[];
  inspiration?: string;
}

export interface StoreGenerationProvider {
  generateDefinition(input: GenerateStoreInput): Promise<unknown>;
  generatePatch(input: {
    current: StoreDefinition;
    instruction: string;
  }): Promise<unknown>;
}

export class GenerateStoreService {
  constructor(deps: {
    stores: StoreService;
    provider: StoreGenerationProvider;
  });
  generate(shopId: ShopId, input: GenerateStoreInput): Promise<StoreDefinition>;
  edit(shopId: ShopId, instruction: string): Promise<StoreDefinition>;
}
```

`generate`: `raw = await provider.generateDefinition(input)` then `parseStoreDefinition(raw)` then `stores.putDraft(shopId, parsed)`. On parse failure, do not call `putDraft`; throw `DomainError("INVALID_GENERATION", ...)`.

`edit`: `current = await stores.getDraft(shopId)`; `raw = await provider.generatePatch({ current, instruction })`; parse raw as `StorePatch` with Zod:

```ts
const storePatchSchema = z.object({
  operations: z.array(
    z.discriminatedUnion("op", [
      z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }),
      z.object({ op: z.literal("remove"), path: z.string() }),
      z.object({ op: z.literal("move"), from: z.string(), to: z.string() }),
      z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }),
    ]),
  ),
});
```

then `applyStorePatch` then `putDraft`. On failure, draft remains the previous `current`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { FixedClock } from "../clock.ts";
import { MemoryStoreRepository } from "../store/memory-store-repository.ts";
import { StoreService } from "../store/store-service.ts";
import spacious from "../../../schema/src/fixtures/spacious-home.json" with { type: "json" };
import { GenerateStoreService, type StoreGenerationProvider } from "./generate-store.ts";

const shopId = "shop_seed";

class FakeProvider implements StoreGenerationProvider {
  constructor(
    private readonly definition: unknown,
    private readonly patch: unknown,
  ) {}
  async generateDefinition() {
    return this.definition;
  }
  async generatePatch() {
    return this.patch;
  }
}

function stores() {
  return new StoreService({
    stores: new MemoryStoreRepository(),
    clock: new FixedClock(new Date("2026-08-24T12:00:00.000Z")),
  });
}

describe("GenerateStoreService", () => {
  it("writes a valid generation to draft", async () => {
    const storeService = stores();
    const ai = new GenerateStoreService({
      stores: storeService,
      provider: new FakeProvider(spacious, { operations: [] }),
    });
    const def = await ai.generate(shopId, {
      businessType: "home",
      productCategory: "towels",
      brandDescription: "premium",
      aesthetic: "zara home",
    });
    expect(def.store.name).toBe("Juneheart");
    expect((await storeService.getDraft(shopId)).store.name).toBe("Juneheart");
  });

  it("keeps the previous draft when generation is invalid", async () => {
    const storeService = stores();
    await storeService.putDraft(shopId, spacious);
    const ai = new GenerateStoreService({
      stores: storeService,
      provider: new FakeProvider(
        { version: 1, pages: { home: { sections: [{ type: "magic-hero", props: {} }] } } },
        { operations: [] },
      ),
    });
    await expect(
      ai.generate(shopId, {
        businessType: "x",
        productCategory: "y",
        brandDescription: "z",
        aesthetic: "a",
      }),
    ).rejects.toMatchObject({ code: "INVALID_GENERATION" });
    expect((await storeService.getDraft(shopId)).pages.home.sections[0]?.type).toBe(
      "hero",
    );
  });

  it("patches draft instead of replacing the whole definition", async () => {
    const storeService = stores();
    await storeService.putDraft(shopId, spacious);
    const ai = new GenerateStoreService({
      stores: storeService,
      provider: new FakeProvider(spacious, {
        operations: [
          { op: "replace", path: "pages.home.sections.0.props.size", value: "medium" },
        ],
      }),
    });
    const edited = await ai.edit(shopId, "Hero jest za duży");
    expect(edited.pages.home.sections.length).toBe(3);
    if (edited.pages.home.sections[0]?.type === "hero") {
      expect(edited.pages.home.sections[0].props.size).toBe("medium");
    }
  });
});
```

If JSON import assertions fail on the TS version, load fixtures with `fs.readFileSync` as in Phase 2.

- [ ] **Step 2: FAIL then implement `GenerateStoreService` then PASS**

- [ ] **Step 3: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: generate and patch Store Definition through a provider port

EOF
)"
```

---

### Task 3: Product copy helper that cannot set operational fields

**Files:**
- Create: `packages/core/src/ai/product-copy.ts`
- Test: `packages/core/src/ai/product-copy.test.ts`

**Interfaces:**
- Consumes: `Product` (read), `ProductRepository.save`
- Produces:

```ts
export interface ProductCopyProvider {
  generateCopy(input: {
    name: string;
    description: string;
    instruction: "description" | "seo" | "alt";
  }): Promise<{
    description?: string;
    metadata?: Record<string, string>;
  }>;
}

export class ProductCopyService {
  constructor(deps: {
    products: ProductRepository;
    provider: ProductCopyProvider;
  });
  improve(
    shopId: ShopId,
    productId: ProductId,
    instruction: "description" | "seo" | "alt",
  ): Promise<Product>;
}
```

`improve` loads product, calls provider, then applies **only**:

- `description` instruction → `product.description`
- `seo` → `metadata.seoTitle`, `metadata.seoDescription`
- `alt` → `metadata.altText`

If the provider result object contains `price`, `sku`, `status`, `images`, or `metadata` keys other than the ones above, ignore them. Test that a malicious provider returning `{ price: 1, sku: "HACK", description: "ok" }` leaves `price` and `sku` unchanged.

- [ ] **Step 1: Write that malicious-provider test first**

```ts
it("ignores sku and price from the model", async () => {
  // create product price 19900 sku TOWEL-BLUE
  const provider: ProductCopyProvider = {
    async generateCopy() {
      return {
        description: "Nowe zdanie.",
        sku: "HACK",
        price: 1,
      } as { description: string };
    },
  };
  // improve description
  // expect sku TOWEL-BLUE, price 19900, description Nowe zdanie.
});
```

Casting: give `generateCopy` return type a test double that returns extra keys via `as unknown as ...`. The service must still strip them.

- [ ] **Step 2: Implement whitelist apply + PASS**

- [ ] **Step 3: Commit**

```bash
git add packages/core
git commit -m "$(cat <<'EOF'
feat: allow AI product copy without changing operational fields

EOF
)"
```

---

### Task 4: Bedrock adapter (apps/web only)

**Files:**
- Create: `apps/web/src/lib/bedrock-store-generation.ts`
- Create: `apps/web/src/lib/bedrock-product-copy.ts`
- Modify: `sst.config.ts` add `sst.Secret("BedrockRegion")` only if not using the app AWS region; link no extra table
- Modify: `apps/web/src/lib/core.ts` to inject the adapter when `Resource` credentials exist, else `FakeStoreGenerationProvider` in `sst dev` if `LITESHOP_FAKE_AI=1`

**Interfaces:**
- Consumes: `StoreGenerationProvider`, `ProductCopyProvider`
- Produces: Bedrock `Converse` (or equivalent) with `responseFormat` / tool schema matching `storeDefinitionSchema` JSON Schema (export `storeDefinitionJsonSchema` from `@liteshop/schema` via `zodToJsonSchema` — add dependency `zod-to-json-schema` on `@liteshop/schema`).

System prompt (exact):

```text
You output only a StoreDefinition JSON object that validates against the provided schema.
You never invent SKU, prices, inventory, tax, weight, or dimensions.
You never output TypeScript, DynamoDB keys, IAM, or inbound API handlers.
Section types allowed: hero, product-grid, featured-product, split-story, text, image, gallery, testimonials, faq, newsletter, logo-cloud, spacer.
```

Edit prompt includes `JSON.stringify(current)` and the merchant instruction, asking for `{ "operations": [ ... ] }` only.

If Bedrock returns non-JSON, the adapter throws; `GenerateStoreService` maps that to `INVALID_GENERATION`.

Do not put the Bedrock client in `packages/core`.

- [ ] **Step 1: Export JSON Schema from `@liteshop/schema`**

```ts
import { zodToJsonSchema } from "zod-to-json-schema";
export const storeDefinitionJsonSchema = zodToJsonSchema(storeDefinitionSchema);
```

Unit test: schema JSON `properties` includes `pages`.

- [ ] **Step 2: Implement adapter wrapping `@aws-sdk/client-bedrock-runtime`**

Keep model id in `sst.Secret("BedrockModelId")`.

- [ ] **Step 3: Commit**

```bash
git add apps/web packages/schema sst.config.ts
git commit -m "$(cat <<'EOF'
feat: add Bedrock StoreDefinition provider behind the generation port

EOF
)"
```

---

### Task 5: AI Designer admin UI

**Files:**
- Create: `apps/web/src/pages/admin/designer.astro`
- Create: `apps/web/src/islands/AiDesigner.tsx`
- Create: `apps/web/src/pages/api/admin/ai/generate.ts`
- Create: `apps/web/src/pages/api/admin/ai/edit.ts`
- Create: `apps/web/src/pages/api/admin/ai/product-copy.ts`
- Modify: `apps/web/src/pages/admin/products/index.astro` — buttons `Generate description`, `Improve SEO`, `Generate alt text` posting to product-copy with `{ productId, instruction }`

**Interfaces:**
- Consumes: `GenerateStoreService`, admin session
- Produces: UI copy from PRD §39 (Polish):

```text
Jak chcesz zmienić sklep?
[ textarea ]
[ Generate ]
```

First-time generate form fields: business type, category, brand description, aesthetic (required); website, colours, inspiration optional. Submit `POST /api/admin/ai/generate`. On `INVALID_GENERATION`, flash `Nie udało się wygenerować sklepu. Poprzedni szkic został zachowany.` and keep draft.

Edit form: single instruction → `POST /api/admin/ai/edit`. Success redirects to `/preview`.

`GenerateStoreInput` Zod in the API route:

```ts
z.object({
  businessType: z.string().min(1),
  productCategory: z.string().min(1),
  brandDescription: z.string().min(1),
  aesthetic: z.string().min(1),
  existingWebsite: z.string().url().optional(),
  brandColours: z.array(z.string()).optional(),
  inspiration: z.string().optional(),
});
```

- [ ] **Step 1: Implement routes + island**

`AiDesigner.tsx` is a controlled textarea + submit; no client-side schema generation.

- [ ] **Step 2: Browser-check**

1. Generate from “Minimalistyczny sklep z ceramiką…” → `/preview` shows valid sections.
2. Edit “Hero jest za duży…” → draft hero size changes, `/` published unchanged until Publish.
3. Product copy does not change price in admin.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "$(cat <<'EOF'
feat: add AI Designer that only writes validated drafts

EOF
)"
```

---

## Phase 3 / MVP gate (PRD §49)

A new merchant can:

1. Generate a storefront from one prompt.
2. Preview it (`/preview` = draft).
3. Change design with a second prompt (patch).
4. Add at least 10 products with images, prices, inventory (Phase 1 admin).
5. Connect Furgonetka (Phase 1 OAuth).
6. Publish under a domain (Phase 2 settings + SST domain).
7. Place a real test order, payment callback, inventory decrement once.
8. Inspect the order in admin and open Furgonetka.
9. Manage stock via delivery and adjustment.
10. Roll back a storefront design version.

All of the above must still obey: LLM never wrote commerce code; published unchanged until explicit Publish.

Parent plan: [2026-08-24-liteshop-mvp.md](./2026-08-24-liteshop-mvp.md)
