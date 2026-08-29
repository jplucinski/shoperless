import { defineMiddleware } from "astro:middleware";
import { Resource } from "sst";
import { isAdminSession, SESSION_COOKIE } from "./lib/session.ts";

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (
    path.startsWith("/admin") &&
    path !== "/admin/login" &&
    !path.startsWith("/api/admin/furgonetka/")
  ) {
    const cookie = context.cookies.get(SESSION_COOKIE)?.value;
    if (!isAdminSession(cookie, Resource.AdminPassword.value)) {
      return context.redirect("/admin/login");
    }
  }
  return next();
});
