import { PORTS } from "./config.js";
import { createMockOktaApp } from "./services/okta.js";
import { createMockAuthZApp } from "./services/authz.js";
import { createServiceBApp } from "./services/service-b.js";
import { createServiceAApp } from "./services/service-a.js";

/**
 * SIMPLE LOCAL DEMO - Option B Architecture
 *
 * - Mock Okta issues JWTs signed with HMAC (HS256) for simplicity
 * - Service B validates JWT locally (no round trip to IdP per request)
 * - Service B calls AuthZ for ABAC/ReBAC decisions
 * - Demonstrates both service-to-service and user context scenarios
 */

async function main() {
  createMockOktaApp().listen(PORTS.okta, () => 
    console.log(`Mock Okta listening on :${PORTS.okta}`)
  );
  
  createMockAuthZApp().listen(PORTS.authz, () => 
    console.log(`Mock AuthZ listening on :${PORTS.authz}`)
  );
  
  createServiceBApp().listen(PORTS.serviceB, () => 
    console.log(`Service B listening on :${PORTS.serviceB}`)
  );
  
  createServiceAApp().listen(PORTS.serviceA, () => 
    console.log(`Service A listening on :${PORTS.serviceA}`)
  );

  console.log("\nTry:");
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-without-user-context`);
  console.log(`  curl http://localhost:${PORTS.serviceA}/demo/read-with-user-context`);
  console.log(`  curl -X POST http://localhost:${PORTS.serviceA}/demo/write-without-user-context`);
  console.log(`  curl -X POST http://localhost:${PORTS.serviceA}/demo/write-with-user-context`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
