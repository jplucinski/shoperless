import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIRoute } from "astro";
import { SEED_SHOP_ID, keys } from "@liteshop/core";
import { encryptRefreshToken, parseTokenResponse } from "@liteshop/furgonetka";
import { Resource } from "sst";
import { sessionCookieHeader } from "../../../../lib/session.ts";

export const GET: APIRoute = async ({ url, cookies }) => {
  const state = url.searchParams.get("state");
  const expected = cookies.get("ls_oauth_state")?.value;
  if (!state || !expected || state !== expected) {
    return new Response("Invalid state", { status: 400 });
  }
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("Missing code", { status: 400 });
  }
  const redirectUri = `${url.origin}/api/admin/furgonetka/callback`;
  const tokenRes = await fetch("https://api.furgonetka.pl/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: Resource.FurgonetkaClientId.value,
      client_secret: Resource.FurgonetkaClientSecret.value,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return new Response("Token exchange failed", { status: 502 });
  }
  const tokens = parseTokenResponse(await tokenRes.json());
  const ciphertext = encryptRefreshToken(
    tokens.refreshToken,
    Resource.TokenEncryptionKey.value,
  );
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  await doc.send(
    new PutCommand({
      TableName: Resource.Table.name,
      Item: {
        ...keys.furgonetka(SEED_SHOP_ID),
        shopId: SEED_SHOP_ID,
        accountId: "furgonetka",
        refreshTokenCiphertext: ciphertext,
        connectedAt: new Date().toISOString(),
        status: "connected",
      },
    }),
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin",
      "Set-Cookie": sessionCookieHeader(Resource.AdminPassword.value),
    },
  });
};
