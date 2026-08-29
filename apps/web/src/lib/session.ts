import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ls_session";

export function signAdminSession(secret: string): string {
  return createHmac("sha256", secret).update("admin").digest("hex");
}

export function isAdminSession(
  cookieValue: string | undefined,
  secret: string,
): boolean {
  if (!cookieValue) return false;
  const expected = Buffer.from(signAdminSession(secret));
  const actual = Buffer.from(cookieValue);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function sessionCookieHeader(secret: string): string {
  return `${SESSION_COOKIE}=${signAdminSession(secret)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
}
