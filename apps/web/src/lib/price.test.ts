import { describe, expect, it } from "vitest";
import { parsePriceGrosze } from "./price.ts";

describe("parsePriceGrosze", () => {
  it("parses złoty with two decimals", () => {
    expect(parsePriceGrosze("19.99")).toBe(1999);
  });

  it("parses whole złoty", () => {
    expect(parsePriceGrosze("199")).toBe(19900);
  });
});
