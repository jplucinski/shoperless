import type { APIRoute } from "astro";
import { buildAuthorizeUrl } from "@liteshop/furgonetka";
import { Resource } from "sst";
import { oauthStateCookieHeader } from "../../../../lib/session.ts";

export const GET: APIRoute = ({ url }) => {
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/admin/furgonetka/callback`;
  const location = buildAuthorizeUrl({
    clientId: Resource.FurgonetkaClientId.value,
    redirectUri,
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": oauthStateCookieHeader(state, url),
    },
  });
};
