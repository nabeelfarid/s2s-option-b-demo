import express from "express";
import fetch from "node-fetch";
import { extractBearerToken } from "../utils/auth";
import { validateMockOktaJwt, validateOktaJwt } from "../utils/jwt";
import { MOCK_OKTA_CONFIG, PORTS } from "../config";
import type { PolicyCheckRequest, PolicyCheckResponse } from "../types";

/**
 * Service B (API being called)
 * Validates JWT locally, then calls AuthZ for policy decisions
 */
export function createServiceBApp() {
  const app = express();
  app.use(express.json());

  function validateMockOktaBearerToken(authHeader?: string) {
    const token = extractBearerToken(authHeader);
    if (!token) throw new Error("missing_bearer");
    return validateMockOktaJwt(token, MOCK_OKTA_CONFIG.serviceBAud);
  }

  async function validateOktaBearerToken(authHeader?: string) {
    const token = extractBearerToken(authHeader);
    if (!token) throw new Error("missing_bearer");
    // Seems like M2M Okta access tokens use "api://default" as default audience (for /oauth2/default auth server)
    // where as OIDC Okta access tokens use the Okta org level issuer URL "https://fusiondev.oktapreview.com" as audience for dashboard/user tokens
    // return await validateRealOktaJwt(token, "<api://default" | "https://fusiondev.oktapreview.com">);
    return await validateOktaJwt(token, "");
  }

  async function authZCheck(input: PolicyCheckRequest): Promise<PolicyCheckResponse> {
    const resp = await fetch(`http://localhost:${PORTS.mockAuthz}/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!resp.ok) throw new Error(`authz_error_${resp.status}`);
    return (await resp.json()) as PolicyCheckResponse;
  }

  // NEW: Endpoint for real Okta tokens only
  // IMPORTANT: This must come BEFORE /wallet/:id to avoid being matched as an ID
  app.get("/wallet/real-okta", async (req, res) => {
    try {
      const claims = await validateOktaBearerToken(req.headers.authorization);

      // Okta uses 'cid' for client_id, we normalize it to 'azp' in validateRealOktaJwt
      const actorService = claims.azp || claims.cid || "unknown";

      // Real Okta tokens won't go through AuthZ in this demo
      // In production, you'd integrate with your AuthZ service
      return res.json({
        walletId: "real-okta",
        data: { balance: 999.99 },
        tokenType: "real-okta-rs256",
        validatedVia: "JWKS from real Okta",
        tokenClaimsUsed: {
          iss: claims.iss,
          azp: actorService,
          cid: claims.cid,
          sub: claims.sub ?? null,
          scope: claims.scope ?? (claims.scp ? claims.scp.join(" ") : null),
        },
      });
    } catch (e: any) {
      return res.status(401).json({ error: "unauthorized", detail: e.message });
    }
  });

  app.get("/wallet/:id", async (req, res) => {
    try {
      const claims = validateMockOktaBearerToken(req.headers.authorization);

      const walletId = req.params.id;
      const decision = await authZCheck({
        actorService: claims.azp,
        userId: claims.sub,
        action: "wallet:read",
        resource: `wallet:${walletId}`,
      });

      if (decision.decision !== "ALLOW") {
        return res.status(403).json({ error: "forbidden", reason: decision.reason });
      }

      return res.json({
        walletId,
        data: { balance: 123.45 },
        authorizedBy: decision.reason,
        tokenClaimsUsed: { azp: claims.azp, sub: claims.sub ?? null },
      });
    } catch (e: any) {
      return res.status(401).json({ error: "unauthorized", detail: e.message });
    }
  });

  app.post("/wallet/:id", async (req, res) => {
    try {
      const claims = validateMockOktaBearerToken(req.headers.authorization);

      const walletId = req.params.id;
      const decision = await authZCheck({
        actorService: claims.azp,
        userId: claims.sub,
        action: "wallet:write",
        resource: `wallet:${walletId}`,
      });

      if (decision.decision !== "ALLOW") {
        return res.status(403).json({ error: "forbidden", reason: decision.reason });
      }

      return res.json({ updated: walletId, authorizedBy: decision.reason });
    } catch (e: any) {
      return res.status(401).json({ error: "unauthorized", detail: e.message });
    }
  });

  return app;
}
