import { describe, expect, it } from "vitest";
import { furgonetkaPanelUrl } from "./furgonetka-url.ts";

describe("furgonetkaPanelUrl", () => {
  it("opens the sandbox panel, not an invented order path", () => {
    expect(furgonetkaPanelUrl("sandbox")).toBe("https://sandbox.furgonetka.pl");
  });

  it("opens the production panel", () => {
    expect(furgonetkaPanelUrl("prod")).toBe("https://furgonetka.pl");
  });
});
