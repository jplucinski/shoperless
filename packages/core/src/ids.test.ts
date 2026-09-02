import { describe, expect, it } from "vitest";
import { UlidGenerator } from "./ids.ts";

describe("UlidGenerator", () => {
  const ids = new UlidGenerator();

  it("prefixes a 26-character Crockford ULID", () => {
    expect(ids.productId()).toMatch(/^prd_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(ids.orderId()).toMatch(/^ord_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(ids.eventId()).toMatch(/^evt_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("does not collide in a tight loop", () => {
    const seen = new Set(Array.from({ length: 200 }, () => ids.eventId()));
    expect(seen.size).toBe(200);
  });
});
