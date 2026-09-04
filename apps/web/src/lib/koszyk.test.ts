import { describe, expect, it } from "vitest";
import { koszykCheckoutScriptSrc } from "./koszyk-script.ts";

describe("koszykCheckoutScriptSrc", () => {
  it("uses sandbox unless env is prod", () => {
    expect(koszykCheckoutScriptSrc(undefined)).toBe(
      "https://furgonetka.pl/js/dist/checkout/universal-checkout-sandbox.js",
    );
    expect(koszykCheckoutScriptSrc("sandbox")).toBe(
      "https://furgonetka.pl/js/dist/checkout/universal-checkout-sandbox.js",
    );
    expect(koszykCheckoutScriptSrc("prod")).toBe(
      "https://furgonetka.pl/js/dist/checkout/universal-checkout-prod.js",
    );
  });
});
