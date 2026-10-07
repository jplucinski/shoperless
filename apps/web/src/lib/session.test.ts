import { describe, expect, it } from "vitest";
import { isAdminSession, signAdminSession } from "./session.ts";

const secret = "test-secret";

describe("admin session cookie", () => {
  it("accepts a valid signed session", () => {
    const exp = 2_000_000_000;
    const cookie = signAdminSession(secret, exp);
    expect(isAdminSession(cookie, secret, exp - 1)).toBe(true);
  });

  it("rejects expired session", () => {
    const exp = 1_000_000_000;
    const cookie = signAdminSession(secret, exp);
    expect(isAdminSession(cookie, secret, exp)).toBe(false);
  });

  it("rejects tampered mac", () => {
    const exp = 2_000_000_000;
    const tampered = `${exp}.deadbeef`;
    expect(isAdminSession(tampered, secret, exp - 1)).toBe(false);
  });
});
