import type { PaymentStatus } from "@liteshop/core";

const PAID = new Set(["paid", "completed"]);
const FAILED = new Set(["failed"]);
const CANCELLED = new Set(["cancelled", "canceled"]);
const PENDING = new Set(["pending"]);

export function mapProviderPaymentStatus(providerStatus: string): PaymentStatus {
  const normalized = providerStatus.trim().toLowerCase();
  if (PAID.has(normalized)) return "PAID";
  if (FAILED.has(normalized)) return "FAILED";
  if (CANCELLED.has(normalized)) return "CANCELLED";
  if (PENDING.has(normalized)) return "PENDING";
  throw new Error("unknown furgonetka payment status");
}
