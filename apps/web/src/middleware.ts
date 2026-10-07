import { defineMiddleware } from "astro:middleware";
import { adminSecret, isAdminSession, SESSION_COOKIE } from "./lib/session.ts";

const PUBLIC_ADMIN_API = new Set([
  "/api/admin/login",
  "/api/admin/furgonetka/start",
  "/api/admin/furgonetka/callback",
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  if (path.startsWith("/admin") && path !== "/admin/login") {
    const cookie = context.cookies.get(SESSION_COOKIE)?.value;
    if (!isAdminSession(cookie, adminSecret())) {
      return context.redirect("/admin/login");
    }
  }

  if (path.startsWith("/api/admin") && !PUBLIC_ADMIN_API.has(path)) {
    const cookie = context.cookies.get(SESSION_COOKIE)?.value;
    if (!isAdminSession(cookie, adminSecret())) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  return next();
});
