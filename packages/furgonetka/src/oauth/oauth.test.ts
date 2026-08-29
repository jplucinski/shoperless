import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl, parseTokenResponse } from "./oauth.ts";

describe("buildAuthorizeUrl", () => {
  it("contains response_type=code and the redirect URI", () => {
    const url = buildAuthorizeUrl({
      clientId: "cid",
      redirectUri: "https://shop.example/api/admin/furgonetka/callback",
      state: "nonce",
    });
    expect(url).toContain("response_type=code");
    expect(url).toContain(
      encodeURIComponent("https://shop.example/api/admin/furgonetka/callback"),
    );
  });
});

describe("parseTokenResponse", () => {
  it("reads tokens", () => {
    expect(
      parseTokenResponse({
        access_token: "a",
        refresh_token: "r",
        expires_in: 3600,
      }),
    ).toEqual({ accessToken: "a", refreshToken: "r", expiresIn: 3600 });
  });
});
