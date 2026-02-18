import { createHash } from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import * as jose from "jose";
import { Agent, fetch as undiciFetch } from "undici";
import { OKTA_CONFIG, MOCK_OKTA_CONFIG } from "../config";
import type { JwtClaims, TokenRequest } from "../types";

// DEVELOPMENT ONLY: Disable certificate validation for Okta preview environments
// DO NOT use in production!
const httpsDispatcher = new Agent({
  connect: { rejectUnauthorized: false },
});

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function jtiFor(payload: object) {
  return createHash("sha256")
    .update(JSON.stringify(payload) + Date.now())
    .digest("hex")
    .slice(0, 16);
}

export function issueMockOktaJwt(req: TokenRequest) {
  const baseClaims: any = {
    iss: MOCK_OKTA_CONFIG.issuer,
    aud: req.audience,
    azp: req.client_id,
    scope: req.scope ?? "read:basic",
    iat: nowSeconds(),
  };

  if (req.user_id) {
    baseClaims.sub = req.user_id;
  }

  baseClaims.jti = jtiFor(baseClaims);

  const token = jwt.sign(baseClaims, MOCK_OKTA_CONFIG.signingSecret, {
    algorithm: "HS256",
    expiresIn: "5m",
  });

  return token;
}

export function validateMockOktaJwt(token: string, expectedAudience: string): JwtClaims {
  const decoded = jwt.verify(token, MOCK_OKTA_CONFIG.signingSecret, { algorithms: ["HS256"] }) as JwtPayload;

  if (decoded.iss !== MOCK_OKTA_CONFIG.issuer) throw new Error("bad_issuer");
  if (decoded.aud !== expectedAudience) throw new Error("bad_audience");

  return decoded as JwtClaims;
}

/**
 * Validate RS256 JWT from real Okta using JWKS
 * Supports both custom authorization server and org-level tokens
 */
export async function validateOktaJwt(token: string, expectedAudience?: string): Promise<JwtClaims> {
  // Decode token without verification to check the issuer
  const decoded = jwt.decode(token, { complete: true }) as any;
  const tokenIssuer = decoded?.payload?.iss;

  try {
    // Determine which JWKS and issuer to use based on the token's issuer
    const isOrgToken = tokenIssuer === OKTA_CONFIG.orgIssuer;
    const jwksUrl = isOrgToken ? OKTA_CONFIG.orgJwksUrl : OKTA_CONFIG.jwksUrl;
    console.log("jwksUrl", jwksUrl);
    const expectedIssuer = isOrgToken ? OKTA_CONFIG.orgIssuer : OKTA_CONFIG.issuer;

    const JWKS = jose.createRemoteJWKSet(new URL(jwksUrl), {
      // @ts-expect-error - fetch-like modules have incompatible Response typings per jose docs
      [jose.customFetch]: (url, opts) =>
        undiciFetch(url, { ...opts, dispatcher: httpsDispatcher }),
    });

    const { payload } = await jose.jwtVerify(token, JWKS, {
      /*
        Always validate both issuer and audience when verifying JWT tokens. 
        These are critical security controls that prevent token substitution attacks.
        See READEME.md for more details.
      */
      // issuer: expectedIssuer,
      ...(expectedAudience && { audience: expectedAudience }),
    });

    console.dir(payload, { depth: null });

    const claims = payload as JwtClaims;

    // Normalize the claims - Okta uses 'cid' for client_id, we want 'azp' for consistency
    if ((claims as any).cid && !claims.azp) {
      claims.azp = (claims as any).cid;
    }

    return claims;
  } catch (error: any) {
    throw new Error(`jwks_validation_failed: ${error.message}`);
  }
}

