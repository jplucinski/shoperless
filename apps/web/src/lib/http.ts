import { DomainError } from "@liteshop/core";

export function toHttpError(error: unknown): {
  status: number;
  body: { code: string; message: string };
} {
  if (error instanceof DomainError) {
    const conflict = new Set([
      "INSUFFICIENT_STOCK",
      "PRODUCT_INACTIVE",
      "PRODUCT_NOT_FOUND",
      "INVALID_CART",
    ]);
    if (conflict.has(error.code)) {
      return { status: 409, body: { code: error.code, message: error.message } };
    }
    if (error.code === "ORDER_NOT_FOUND") {
      return { status: 404, body: { code: error.code, message: error.message } };
    }
    return { status: 500, body: { code: error.code, message: "internal_error" } };
  }
  return { status: 500, body: { code: "INTERNAL", message: "internal_error" } };
}
