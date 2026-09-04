import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_EVENT, CART_KEY, cartQuantity, readCart, writeCart } from "./cart-storage.ts";

function installCartMemory() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  const dispatched: string[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: (event: Event) => {
      dispatched.push(event.type);
      return true;
    },
  });
  return { dispatched };
}

describe("cartQuantity", () => {
  it("sums quantities", () => {
    expect(cartQuantity([])).toBe(0);
    expect(
      cartQuantity([
        { sku: "A", quantity: 1 },
        { sku: "B", quantity: 3 },
      ]),
    ).toBe(4);
  });
});

describe("readCart", () => {
  beforeEach(() => {
    installCartMemory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty list when storage is missing, corrupt, or not a cart", () => {
    expect(readCart()).toEqual([]);
    localStorage.setItem(CART_KEY, "{");
    expect(readCart()).toEqual([]);
    localStorage.setItem(CART_KEY, JSON.stringify({ items: "nope" }));
    expect(readCart()).toEqual([]);
  });
});

describe("writeCart", () => {
  let dispatched: string[] = [];

  beforeEach(() => {
    dispatched = installCartMemory().dispatched;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists items and dispatches liteshop:cart", () => {
    writeCart([{ sku: "TOWEL-BLUE", quantity: 2 }]);
    expect(readCart()).toEqual([{ sku: "TOWEL-BLUE", quantity: 2 }]);
    expect(JSON.parse(localStorage.getItem(CART_KEY) ?? "{}")).toEqual({
      items: [{ sku: "TOWEL-BLUE", quantity: 2 }],
    });
    expect(dispatched).toContain(CART_EVENT);
  });
});
