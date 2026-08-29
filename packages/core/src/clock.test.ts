import { describe, expect, it } from "vitest";
import { FixedClock } from "./clock.ts";

describe("FixedClock", () => {
  it("returns the injected instant", () => {
    const instant = new Date("2026-08-24T12:00:00.000Z");
    const clock = new FixedClock(instant);
    expect(clock.now().toISOString()).toBe("2026-08-24T12:00:00.000Z");
  });
});
