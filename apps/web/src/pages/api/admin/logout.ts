import type { APIRoute } from "astro";
import { clearSessionCookieHeader } from "../../../lib/session.ts";

export const POST: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/login",
      "Set-Cookie": clearSessionCookieHeader(url),
    },
  });
};
