import { describe, expect, it } from "vitest";
import { mapProviderPaymentStatus } from "./payment-status.ts";

describe("mapProviderPaymentStatus", () => {
  it("maps paid variants to PAID", () => {
    expect(mapProviderPaymentStatus("paid")).toBe("PAID");
    expect(mapProviderPaymentStatus("PAID")).toBe("PAID");
    expect(mapProviderPaymentStatus("completed")).toBe("PAID");
  });

  it("maps failed, cancelled, and pending", () => {
    expect(mapProviderPaymentStatus("failed")).toBe("FAILED");
    expect(mapProviderPaymentStatus("cancelled")).toBe("CANCELLED");
    expect(mapProviderPaymentStatus("canceled")).toBe("CANCELLED");
    expect(mapProviderPaymentStatus("pending")).toBe("PENDING");
  });
});
