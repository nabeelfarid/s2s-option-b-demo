export const OKTA_ISSUER = "https://mock-okta.local";
export const SERVICE_B_AUD = "service-b";
export const SIGNING_SECRET = "dev-only-super-secret"; // demo only; do not do this in prod

export const PORTS = {
  okta: 4001,
  authz: 4002,
  serviceB: 4003,
  serviceA: 4004,
} as const;
