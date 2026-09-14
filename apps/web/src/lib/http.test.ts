import { describe, expect, it } from "vitest";
import { DomainError } from "@liteshop/core";
import { ZodError } from "zod";
import { toHttpError } from "./http.ts";

describe("toHttpError", () => {
  it("maps INSUFFICIENT_STOCK to 409", () => {
    const err = new DomainError("INSUFFICIENT_STOCK", "no stock");
    expect(toHttpError(err)).toEqual({
      status: 409,
      body: { code: "INSUFFICIENT_STOCK", message: "no stock" },
    });
  });

  it("maps ZodError to 400", () => {
    const err = new ZodError([
      {
        code: "invalid_type",
        expected: "array",
        received: "undefined",
        path: ["items"],
        message: "Required",
      },
    ]);
    expect(toHttpError(err)).toEqual({
      status: 400,
      body: { code: "INVALID_CART", message: "invalid items" },
    });
  });
});
