import express from "express";
import type { PolicyCheckRequest } from "../types";

/**
 * Mock Authorization Service (Policy Engine)
 * Demonstrates ABAC/ReBAC decision making
 */
export function createMockAuthZApp() {
  const app = express();
  app.use(express.json());

  app.post("/authorize", (req, res) => {
    const body = req.body as PolicyCheckRequest;

    // Example policy rules:
    // 1) service-a can read any wallet
    // 2) service-a can write wallet ONLY if userId is present
    // 3) service-c can read only wallet:public
    let allow = false;
    let reason = "no_matching_policy";

    if (body.actorService === "service-a" && body.action === "wallet:read") {
      allow = true;
      reason = "policy:service-a-read";
    }

    if (body.actorService === "service-a" && body.action === "wallet:write") {
      if (body.userId) {
        allow = true;
        reason = "policy:service-a-write-with-user";
      } else {
        allow = false;
        reason = "policy:requires-user-context";
      }
    }

    if (
      body.actorService === "service-c" &&
      body.action === "wallet:read" &&
      body.resource === "wallet:public"
    ) {
      allow = true;
      reason = "policy:service-c-public-only";
    }

    return res.json({ decision: allow ? "ALLOW" : "DENY", reason });
  });

  return app;
}
