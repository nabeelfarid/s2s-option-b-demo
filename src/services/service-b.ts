import express from "express";
import fetch from "node-fetch";
import { validateJwt } from "../utils/jwt.js";
import { SERVICE_B_AUD, PORTS } from "../config.js";
import type { PolicyCheckRequest, PolicyCheckResponse } from "../types.js";

/**
 * Service B (API being called)
 * Validates JWT locally, then calls AuthZ for policy decisions
 */
export function createServiceBApp() {
  const app = express();
  app.use(express.json());

  function validateBearerToken(authHeader?: string) {
    if (!authHeader?.startsWith("Bearer ")) throw new Error("missing_bearer");
    const token = authHeader.slice("Bearer ".length);
    return validateJwt(token, SERVICE_B_AUD);
  }

  async function authZCheck(input: PolicyCheckRequest): Promise<PolicyCheckResponse> {
    const resp = await fetch(`http://localhost:${PORTS.authz}/authorize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!resp.ok) throw new Error(`authz_error_${resp.status}`);
    return (await resp.json()) as PolicyCheckResponse;
  }

  app.get("/wallet/:id", async (req, res) => {
    try {
      const claims = validateBearerToken(req.headers.authorization);

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
      const claims = validateBearerToken(req.headers.authorization);

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
