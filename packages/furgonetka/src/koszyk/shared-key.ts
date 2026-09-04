import { timingSafeEqual } from "node:crypto";

export const AUTH_HEADER = "Authorization";

/** @deprecated use AUTH_HEADER */
export const SHARED_KEY_HEADER = AUTH_HEADER;

export function verifySharedKey(
  headerValue: string | null,
  expected: string,
): boolean {
  if (headerValue === null) return false;
  const token = headerValue.startsWith("Bearer ")
    ? headerValue.slice("Bearer ".length)
    : headerValue;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
