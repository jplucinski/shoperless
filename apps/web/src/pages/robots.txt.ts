import type { APIRoute } from "astro";
import { robotsTxt } from "../lib/crawler-docs.ts";

export const GET: APIRoute = ({ url }) =>
  new Response(robotsTxt(url.origin), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
