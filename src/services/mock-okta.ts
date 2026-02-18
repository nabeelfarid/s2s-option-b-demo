import express from "express";
import { issueMockOktaJwt } from "../utils/jwt";
import type { TokenRequest } from "../types";

/**
 * Mock Okta (IdP)
 * Issues JWTs signed with HMAC secret (HS256) for simplicity.
 * In real Okta, tokens are RS256 and validated via JWKS.
 */
export function createMockOktaApp() {
  const app = express();
  app.use(express.json());

  const validClients = new Map<string, string>([
    ["service-a", "service-a-secret"],
    ["service-b", "service-b-secret"],
    ["service-c", "service-c-secret"],
  ]);

  app.post("/oauth2/token", (req, res) => {
    const body = req.body as TokenRequest;

    const expectedSecret = validClients.get(body.client_id);
    if (!expectedSecret || expectedSecret !== body.client_secret) {
      return res.status(401).json({ error: "invalid_client" });
    }

    if (!body.audience) {
      return res.status(400).json({ error: "missing_audience" });
    }

    const access_token = issueMockOktaJwt(body);

    return res.json({
      token_type: "Bearer",
      expires_in: 300,
      access_token,
    });
  });

  return app;
}
