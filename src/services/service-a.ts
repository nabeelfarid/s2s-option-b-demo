import express from "express";
import fetch from "node-fetch";
import { SERVICE_B_AUD, PORTS } from "../config.js";
import type { TokenRequest, TokenResponse } from "../types.js";

/**
 * Service A (caller)
 * Demonstrates different scenarios: with/without user context
 */
export function createServiceAApp() {
  const app = express();
  app.use(express.json());

  async function requestToken(params: TokenRequest) {
    const resp = await fetch(`http://localhost:${PORTS.okta}/oauth2/token`, {
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

  // No user context
  app.get("/demo/read-without-user-context", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: SERVICE_B_AUD,
      scope: "wallet:read",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc");
    res.status(status).json({ scenario: "read-without-user-context", ...data });
  });

  // With user context
  app.get("/demo/read-with-user-context", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: SERVICE_B_AUD,
      scope: "wallet:read wallet:write",
      user_id: "user-123",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc");
    res.status(status).json({ scenario: "read-with-user-context", ...data });
  });

  // Write without user context (should be denied)
  app.post("/demo/write-without-user-context", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: SERVICE_B_AUD,
      scope: "wallet:write",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc", "POST");
    res.status(status).json({ scenario: "write-without-user-context", ...data });
  });

  // Write with user context (should be allowed)
  app.post("/demo/write-with-user-context", async (_req, res) => {
    const token = await requestToken({
      client_id: "service-a",
      client_secret: "service-a-secret",
      audience: SERVICE_B_AUD,
      scope: "wallet:write",
      user_id: "user-123",
    });

    const { status, data } = await callServiceB(token, "/wallet/abc", "POST");
    res.status(status).json({ scenario: "write-with-user-context", ...data });
  });

  return app;
}
