import express from "express";
import fetch from "node-fetch";
import https from "https";
import { MOCK_OKTA_CONFIG, PORTS, OKTA_CONFIG } from "../config";
import { extractBearerToken } from "../utils/auth";
import type { TokenRequest, TokenResponse } from "../types";

// DEVELOPMENT ONLY: Disable certificate validation for Okta preview environments
// DO NOT use in production!
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Service A (caller)
 * Demonstrates different scenarios: with/without user context
 */
export function createServiceAApp() {
  const app = express();
  app.use(express.json());

  async function requestToken(params: TokenRequest) {
    const resp = await fetch(`http://localhost:${PORTS.mockOkta}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!resp.ok) throw new Error(`token_error_${resp.status}`);
    const json = (await resp.json()) as TokenResponse;
    return json.access_token;
  }

  async function callServiceB(token: string, path: string, method = "GET") {
    const resp = await fetch(`http://localhost:${PORTS.serviceB}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await resp.json()) as Record<string, unknown>;
    return { status: resp.status, data };
  }

  /**
   * Get client credentials token from Okta (for M2M scenarios)
   * Uses /oauth2/default endpoint where API scopes are configured
   */
  async function requestClientCredentialsTokenFromOkta({ clientId, clientSecret, scope, audience }: { clientId: string, clientSecret: string, scope: string, audience: string }) {
    const authString = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");
    const resp = await fetch(OKTA_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authString}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope,
        audience,
      }).toString(),
      agent: httpsAgent,
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`client_credentials_token_request_from_okta_error_${resp.status}: ${error}`);
    }

    const json = (await resp.json()) as TokenResponse;
    return json.access_token;
  }

  /**
   * Exchange user token for Service B-scoped token using OAuth 2.0 Token Exchange (OBO)
   * RFC 8693: https://datatracker.ietf.org/doc/html/rfc8693
   *
   * Service A authenticates via Basic auth (client_secret_basic) and exchanges
   * the user's token for a new token scoped for the /oauth2/default auth server.
   */
  async function exchangeTokenUsingOboFromOkta({ userAccessToken, scope, audience }: { userAccessToken: string, scope: string, audience: string }): Promise<string> {
    const authString = Buffer.from(
      `${OKTA_CONFIG.serviceAClientId}:${OKTA_CONFIG.serviceAClientSecret}`
    ).toString("base64");

    const resp = await fetch(OKTA_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${authString}`,
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
        subject_token: userAccessToken,
        audience: audience,
        scope: scope,
      }).toString(),
      agent: httpsAgent,
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`token_exchange_error_${resp.status}: ${error}`);
    }

    const json = (await resp.json()) as TokenResponse;
    return json.access_token;
  }

  // Mock Okta: No user context
  app.get("/demo/read-without-user-context-using-mock-okta", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: MOCK_OKTA_CONFIG.serviceBAud,
      scope: "wallet:read",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc");
    res.status(status).json({ scenario: "read-without-user-context-using-mock-okta", ...data });
  });

  // Mock Okta: With user context
  app.get("/demo/read-with-user-context-using-mock-okta", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: MOCK_OKTA_CONFIG.serviceBAud,
      scope: "wallet:read wallet:write",
      user_id: "user-123",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc");
    res.status(status).json({ scenario: "read-with-user-context-using-mock-okta", ...data });
  });

  // Mock Okta: Write without user context (should be denied)
  app.post("/demo/write-without-user-context-using-mock-okta", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: MOCK_OKTA_CONFIG.serviceBAud,
      scope: "wallet:write",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc", "POST");
    res.status(status).json({ scenario: "write-without-user-context-using-mock-okta", ...data });
  });

  // Mock Okta: Write with user context (should be allowed)
  app.post("/demo/write-with-user-context-using-mock-okta", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: MOCK_OKTA_CONFIG.serviceBAud,
      scope: "wallet:write",
      user_id: "user-123",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc", "POST");
    res.status(status).json({ scenario: "write-with-user-context-using-mock-okta", ...data });
  });

  // Real Okta: M2M (no user context, service-to-service only)
  app.get("/demo/read-without-user-context-using-real-okta", async (_req, res) => {
    try {
      const token = await requestClientCredentialsTokenFromOkta({
        clientId: OKTA_CONFIG.serviceAClientId,
        clientSecret: OKTA_CONFIG.serviceAClientSecret,
        scope: OKTA_CONFIG.defaultScope,
        audience: OKTA_CONFIG.defaultAudience,
      });

      // Call service B with real Okta token (client credentials)
      // Note: Service B will validate this using JWKS
      const { status, data } = await callServiceB(token, "/wallet/real-okta");

      res.status(status).json({
        scenario: "read-without-user-context-using-real-okta",
        message: "Authenticated with real Okta using client credentials (M2M)",
        ...data
      });
    } catch (error: any) {
      res.status(500).json({
        scenario: "read-without-user-context-using-real-okta",
        error: "failed",
        detail: error.message
      });
    }
  });

  // Real Okta: WITH user context - forwarding user access token from frontend as it is to Service B
  app.get("/demo/read-with-user-context-using-real-okta", async (req, res) => {
    try {
      const userAccessToken = extractBearerToken(req.headers.authorization);
      if (!userAccessToken) {
        return res.status(401).json({
          scenario: "read-with-user-context-using-real-okta",
          error: "missing_token",
          message: "Authorization: Bearer <token> required"
        });
      }

      // Forward user token to Service B
      const { status, data } = await callServiceB(userAccessToken, "/wallet/real-okta");

      res.status(status).json({
        scenario: "read-with-user-context-using-real-okta",
        message: "Forwarded user access token to Service B",
        ...data
      });
    } catch (error: any) {
      res.status(500).json({
        scenario: "read-with-user-context-using-real-okta",
        error: "failed",
        detail: error.message
      });
    }
  });

  // Real Okta: WITH user context - exchanging user access token for Service B-scoped token using OBO Token Exchange
  app.get("/demo/read-with-user-context-using-obo-real-okta", async (req, res) => {
    try {
      console.log("\n" + "=".repeat(60));
      console.log("SERVICE A: OBO Token Exchange Flow");
      console.log("=".repeat(60));

      // Extract user token from Authorization header
      const userAccessToken = extractBearerToken(req.headers.authorization);
      if (!userAccessToken) {
        return res.status(401).json({
          scenario: "read-with-user-context-using-obo-real-okta",
          error: "missing_token",
          message: "Authorization: Bearer <token> required"
        });
      }
      console.log("[Service A] - Received user token from frontend");

      console.log("[Service A] - Exchanging token with Okta (OBO)...");
      const serviceBToken = await exchangeTokenUsingOboFromOkta({ userAccessToken, scope: OKTA_CONFIG.defaultScope, audience: OKTA_CONFIG.defaultAudience });
      console.log("[Service A] - Received new token scoped for Service B");

      console.log("[Service A] - Calling Service B with exchanged token...");
      const { status, data } = await callServiceB(serviceBToken, "/wallet/real-okta");
      console.log("[Service A] - Got response from Service B");
      console.log("=".repeat(60) + "\n");

      res.status(status).json({
        scenario: "read-with-user-context-using-obo-real-okta",
        message: "Used OAuth 2.0 Token Exchange (On-Behalf-Of)",
        flow: "Frontend → Service A → Okta (token exchange) → Service B",
        tokenExchange: {
          performed: true,
          method: "RFC 8693 Token Exchange",
          originalTokenAudience: "(user's original token)",
          exchangedTokenAudience: OKTA_CONFIG.defaultAudience,
          explanation: "Service A exchanged user token for a new token scoped specifically for Service B"
        },
        serviceBResponse: data
      });
    } catch (error: any) {
      console.error("[Service A] - OBO Error:", error.message);
      console.error(error);

      return res.status(500).json({
        scenario: "read-with-user-context-using-obo-real-okta",
        error: "failed",
        detail: error.message,
      });
    }
  });

  return app;
}
