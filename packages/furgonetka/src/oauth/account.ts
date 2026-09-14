import { timingSafeEqual } from "node:crypto";

export function parseAccessTokenAccountId(accessToken: string): string {
  const parts = accessToken.split(".");
  if (parts.length < 2 || !parts[1]) {
    throw new Error("invalid access token");
  }
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
    sub?: unknown;
  };
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("access token missing sub");
  }
  return payload.sub;
}

export function isAllowedAccount(accountId: string, allowed: string): boolean {
  const expected = allowed.trim();
  if (expected.length === 0) return false;
  const a = Buffer.from(accountId);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
