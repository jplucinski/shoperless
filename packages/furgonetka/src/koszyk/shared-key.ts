import { timingSafeEqual } from "node:crypto";

export const SHARED_KEY_HEADER = "X-Furgonetka-Key";

export function verifySharedKey(
  headerValue: string | null,
  expected: string,
): boolean {
  if (headerValue === null) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
