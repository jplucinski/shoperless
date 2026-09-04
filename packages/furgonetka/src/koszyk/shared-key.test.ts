import { describe, expect, it } from "vitest";
import { verifySharedKey } from "./shared-key.ts";

describe("verifySharedKey", () => {
  it("accepts an exact match", () => {
    expect(verifySharedKey("secret", "secret")).toBe(true);
  });

  it("accepts Bearer prefix", () => {
    expect(verifySharedKey("Bearer secret", "secret")).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(verifySharedKey("nope", "secret")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifySharedKey(null, "secret")).toBe(false);
  });
});
