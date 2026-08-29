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
