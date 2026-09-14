import { describe, expect, it } from "vitest";
import { isAllowedAccount, parseAccessTokenAccountId } from "./account.ts";

function jwtWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("parseAccessTokenAccountId", () => {
  it("reads sub from the JWT payload", () => {
    expect(parseAccessTokenAccountId(jwtWithPayload({ sub: "acc-77" }))).toBe("acc-77");
  });
});

describe("isAllowedAccount", () => {
  it("accepts an exact match", () => {
    expect(isAllowedAccount("acc-77", "acc-77")).toBe(true);
  });

  it("rejects a mismatch and an empty allowlist", () => {
    expect(isAllowedAccount("acc-77", "other")).toBe(false);
    expect(isAllowedAccount("acc-77", "")).toBe(false);
    expect(isAllowedAccount("acc-77", "   ")).toBe(false);
  });
});
