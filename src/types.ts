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
  azp: string;
  sub?: string;
  scope?: string;
  iat: number;
  exp: number;
  jti: string;
};