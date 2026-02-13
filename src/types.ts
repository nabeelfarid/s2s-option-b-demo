export type TokenRequest = {
  client_id: string;
  client_secret: string;
  audience: string;
  scope?: string;
  user_id?: string;
};

export type TokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
};

export type PolicyCheckRequest = {
  actorService: string;
  userId?: string;
  action: string;
  resource: string;
};

export type PolicyCheckResponse = {
  decision: "ALLOW" | "DENY";
  reason: string;
};

export type JwtClaims = {
  iss: string;
  aud: string;
  azp: string; // Standard OIDC claim (normalized from 'cid' for Okta)
  sub?: string;
  scope?: string; // Standard OIDC - space-separated string
  iat: number;
  exp: number;
  jti: string;

  // Okta-specific claims (client credentials flow)
  cid?: string; // Okta's client_id claim (normalized to 'azp')
  scp?: string[]; // Okta's scopes as array (e.g., ["scope1", "scope2"])

  // Other possible claims
  client_id?: string; // Some IdPs use this
  ver?: number; // Okta token version
};