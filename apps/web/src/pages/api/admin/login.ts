import { createHash, timingSafeEqual } from "node:crypto";
import type { APIRoute } from "astro";
import { Resource } from "sst";
import { sessionCookieHeader } from "../../../lib/session.ts";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const expected = Resource.AdminPassword.value;
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(expected).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin",
      "Set-Cookie": sessionCookieHeader(expected),
    },
  });
};
