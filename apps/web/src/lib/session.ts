import { createHmac, timingSafeEqual } from "node:crypto";
import { Resource } from "sst";

export const SESSION_COOKIE = "ls_session";

export function adminSecret(): string {
  try {
    return Resource.AdminPassword.value;
  } catch (error) {
    if (import.meta.env.DEV) return "local-dev-admin";
    throw error;
  }
}

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
