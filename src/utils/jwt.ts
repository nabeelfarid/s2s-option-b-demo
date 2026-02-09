import { createHash } from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { OKTA_ISSUER, SIGNING_SECRET } from "../config.js";
import type { JwtClaims, TokenRequest } from "../types.js";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function jtiFor(payload: object) {
  return createHash("sha256")
    .update(JSON.stringify(payload) + Date.now())
    .digest("hex")
    .slice(0, 16);
}

export function issueJwt(req: TokenRequest) {
  const baseClaims: any = {
    iss: OKTA_ISSUER,
    aud: req.audience,
    azp: req.client_id,
    scope: req.scope ?? "read:basic",
    iat: nowSeconds(),
  };

  if (req.user_id) {
    baseClaims.sub = req.user_id;
  }

  baseClaims.jti = jtiFor(baseClaims);

  const token = jwt.sign(baseClaims, SIGNING_SECRET, {
    algorithm: "HS256",
    expiresIn: "5m",
  });

  return token;
}

export function validateJwt(token: string, expectedAudience: string): JwtClaims {
  const decoded = jwt.verify(token, SIGNING_SECRET, { algorithms: ["HS256"] }) as JwtPayload;

  if (decoded.iss !== OKTA_ISSUER) throw new Error("bad_issuer");
  if (decoded.aud !== expectedAudience) throw new Error("bad_audience");

  return decoded as JwtClaims;
}
