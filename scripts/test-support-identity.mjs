import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  configuredSupportEmail,
  DEFAULT_SUPPORT_EMAIL
} from "../lib/support.ts";

assert.equal(DEFAULT_SUPPORT_EMAIL, "support@opportunityscanner.ai");
assert.equal(configuredSupportEmail({}), DEFAULT_SUPPORT_EMAIL);
assert.equal(
  configuredSupportEmail({ OPPORTUNITY_SCANNER_CONTACT_EMAIL: " Help@Example.Test " }),
  "help@example.test"
);
assert.equal(
  configuredSupportEmail({ OPPORTUNITY_SCANNER_CONTACT_EMAIL: "not-an-email" }),
  DEFAULT_SUPPORT_EMAIL
);

const publicSupportSources = await Promise.all([
  "../app/auth/sign-in/page.tsx",
  "../app/opportunities/[id]/page.tsx",
  "../app/privacy/page.tsx",
  "../app/reports/[id]/page.tsx",
  "../lib/transactionalEmail/scanLifecycle.ts"
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

for (const source of publicSupportSources) {
  assert.doesNotMatch(source, /hello@opportunitysystems\.ai|Hi Opportunity Systems/);
  assert.match(source, /configuredSupportEmail/);
}

console.log("Customer support identity checks passed.");
