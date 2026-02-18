/**
 * Extract Bearer token from Authorization header.
 * Returns null if header is missing, malformed, or empty.
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}
