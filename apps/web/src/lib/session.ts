import { createHmac, timingSafeEqual } from "node:crypto";
import { Resource } from "sst";

export const SESSION_COOKIE = "ls_session";
export const OAUTH_STATE_COOKIE = "ls_oauth_state";
const SESSION_MAX_AGE_SEC = 86400;

export function adminSecret(): string {
  try {
    return Resource.AdminPassword.value;
  } catch (error) {
    if (import.meta.env.DEV) return "local-dev-admin";
    throw error;
  }
}

function sessionPayload(expUnix: number): string {
  return String(expUnix);
}

export function signAdminSession(secret: string, expUnix: number): string {
  const mac = createHmac("sha256", secret).update(sessionPayload(expUnix)).digest("hex");
  return `${expUnix}.${mac}`;
}

export function isAdminSession(
  cookieValue: string | undefined,
  secret: string,
  nowUnix = Math.floor(Date.now() / 1000),
): boolean {
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return false;
  const expStr = cookieValue.slice(0, dot);
  const expUnix = Number(expStr);
  if (!Number.isInteger(expUnix) || expUnix <= nowUnix) return false;
  const expected = signAdminSession(secret, expUnix);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(cookieValue);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function sessionCookieHeader(secret: string, requestUrl: URL): string {
  const expUnix = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const value = signAdminSession(secret, expUnix);
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}`;
}

export function clearSessionCookieHeader(requestUrl: URL): string {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
}

export function oauthStateCookieHeader(state: string, requestUrl: URL): string {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  return `${OAUTH_STATE_COOKIE}=${state}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=600`;
}

export function clearOAuthStateCookieHeader(requestUrl: URL): string {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  return `${OAUTH_STATE_COOKIE}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
}

export function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
