// Load environment variables
import "dotenv/config";

// Mock Okta Configuration
export const MOCK_OKTA_CONFIG = {
  issuer: "https://mock-okta.local",
  serviceBAud: "service-b",
  signingSecret: "dev-only-super-secret", // demo only; do not do this in prod
}

// Real Okta Configuration (from environment variables)
export const OKTA_CONFIG = {
  domain: process.env.OKTA_DOMAIN || "",
  // Service A client credentials
  serviceAClientId: process.env.SERVICE_A_OKTA_CLIENT_ID || "",
  serviceAClientSecret: process.env.SERVICE_A_OKTA_CLIENT_SECRET || "",
  serviceAScope: process.env.SERVICE_A_OKTA_SCOPE || "",
  // Custom authorization server (for API tokens)
  issuer: `https://${process.env.OKTA_DOMAIN}/oauth2/default`,
  tokenUrl: `https://${process.env.OKTA_DOMAIN}/oauth2/default/v1/token`,
  jwksUrl: `https://${process.env.OKTA_DOMAIN}/oauth2/default/v1/keys`,
  // Org-level authorization server (for dashboard/internal tokens)
  orgIssuer: `https://${process.env.OKTA_DOMAIN}`,
  orgJwksUrl: `https://${process.env.OKTA_DOMAIN}/oauth2/v1/keys`,
}

export const PORTS = {
  mockOkta: 4001,
  mockAuthz: 4002,
  serviceB: 4003,
  serviceA: 4004,
}
