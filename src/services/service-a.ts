import express from "express";
import fetch from "node-fetch";
import { MOCK_OKTA_CONFIG, PORTS, OKTA_CONFIG } from "../config.js";
import type { TokenRequest, TokenResponse } from "../types.js";

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
   * Get client credentials token from Okta
   */
  async function requestClientCredentialsTokenFromOkta({ clientId, clientSecret, scope }: { clientId: string, clientSecret: string, scope: string }) {
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
      body: `grant_type=client_credentials&scope=${scope}`,
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`client_credentials_token_request_from_okta_error_${resp.status}: ${error}`);
    }

    const json = (await resp.json()) as TokenResponse;
    return json.access_token;
  }

  // No user context
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

  // With user context
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

  // Write without user context (should be denied)
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

  // Write with user context (should be allowed)
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
        scope: OKTA_CONFIG.serviceAScope,
      });

      // Example of a real client-credentials/M2M Okta token
      // {
      //   ver: 1,
      //   jti: 'AT.At0ukd29LjFUpcLGpxDz3FCea9_G3N10IrvD0FKC6do',
      //   iss: 'https://fusiondev.oktapreview.com/oauth2/default',
      //   aud: 'api://default',
      //   iat: 1770919010,
      //   exp: 1770920810,
      //   cid: '0oacswqrjx6yizEZg0x7',
      //   scp: [ 'authzPolicyManagement' ],
      //   sub: '0oacswqrjx6yizEZg0x7',
      //   authz: {
      //     apps: [
      //       {
      //         __entity: {
      //           type: 'PolicyManagementApi::Application',
      //           id: 'authorization-service'
      //         }
      //       }
      //     ]
      //   }
      // }

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

  // Real Okta: WITH user context (expects user access token from frontend)
  app.get("/demo/read-with-user-context-using-real-okta", async (req, res) => {
    try {
      // Extract user token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
          scenario: "read-with-user-context-using-real-okta",
          error: "missing_token",
          message: "Authorization: Bearer <token> required"
        });
      }

      const userAccessToken = authHeader.slice("Bearer ".length);

      // Example of a real user/oidc access token from Okta
      // {
      //   ver: 1,
      //   jti: 'AT.8wVFEk-bERORXSxPJhcawPienMVS35LeHVZogGbN3pg',
      //   iss: 'https://fusiondev.oktapreview.com',
      //   aud: 'https://fusiondev.oktapreview.com',
      //   sub: 'nabeel.farid@tpicap.com',
      //   iat: 1770916799,
      //   exp: 1770920399,
      //   cid: 'okta.2b1959c8-bcc0-56eb-a589-cfcfb7422f26',
      //   uid: '00ucvq2mbzwuYogxA0x7',
      //   scp: [
      //     'openid',
      //     'profile',
      //     'email',
      //     'okta.users.read.self',
      //     'okta.users.manage.self',
      //     'okta.internal.enduser.read',
      //     'okta.internal.enduser.manage',
      //     'okta.enduser.dashboard.read',
      //     'okta.enduser.dashboard.manage',
      //     'okta.myAccount.sessions.manage',
      //     'okta.internal.navigation.enduser.read'
      //   ],
      //   auth_time: 1770914658
      // }

      // Forward user token to Service B
      // Note: Service B will validate this using JWKS
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

  return app;
}
