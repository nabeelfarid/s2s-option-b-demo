import "dotenv/config";
import { PORTS } from "./config";
import { createMockOktaApp } from "./services/mock-okta";
import { createMockAuthZApp } from "./services/mock-authz";
import { createServiceBApp } from "./services/service-b";
import { createServiceAApp } from "./services/service-a";

/**
 * SIMPLE LOCAL DEMO - Option B Architecture
 *
 * - Mock Okta issues JWTs signed with HMAC (HS256) for simplicity
 * - Service B validates JWT locally (no round trip to IdP per request)
 * - Service B calls AuthZ for ABAC/ReBAC decisions
 * - Demonstrates both service-to-service and user context scenarios
 */

async function main() {
  createMockOktaApp().listen(PORTS.mockOkta, () =>
    console.log(`Mock Okta listening on :${PORTS.mockOkta}`)
  );

  createMockAuthZApp().listen(PORTS.mockAuthz, () =>
    console.log(`Mock AuthZ listening on :${PORTS.mockAuthz}`)
  );

  createServiceBApp().listen(PORTS.serviceB, () =>
    console.log(`Service B listening on :${PORTS.serviceB}`)
  );

  createServiceAApp().listen(PORTS.serviceA, () =>
    console.log(`Service A listening on :${PORTS.serviceA}`)
  );

  console.log("\n=== Mock Okta Scenarios ===");
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-without-user-context-using-mock-okta`);
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-with-user-context-using-mock-okta`);
  console.log(`  curl -X POST http://localhost:${PORTS.serviceA}/demo/write-without-user-context-using-mock-okta`);
  console.log(`  curl -X POST http://localhost:${PORTS.serviceA}/demo/write-with-user-context-using-mock-okta`);

  console.log("\n=== Real Okta Scenarios ===");
  console.log(`  # M2M (no user context):`);
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-without-user-context-using-real-okta`);
  console.log(`\n  # With user context - Token Forwarding (requires user token):`);
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-with-user-context-using-real-okta \\`);
  console.log(`    -H "Authorization: Bearer <your-user-token>"`);
  console.log(`\n  # With user context - OBO Token Exchange (requires user token):`);
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-with-user-context-using-obo-real-okta \\`);
  console.log(`    -H "Authorization: Bearer <your-user-token>"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
