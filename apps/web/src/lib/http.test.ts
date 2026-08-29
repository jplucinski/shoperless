import { describe, expect, it } from "vitest";
import { DomainError } from "@liteshop/core";
import { toHttpError } from "./http.ts";

describe("toHttpError", () => {
  it("maps INSUFFICIENT_STOCK to 409", () => {
    const err = new DomainError("INSUFFICIENT_STOCK", "no stock");
    expect(toHttpError(err)).toEqual({
      status: 409,
      body: { code: "INSUFFICIENT_STOCK", message: "no stock" },
    });
  });
});
