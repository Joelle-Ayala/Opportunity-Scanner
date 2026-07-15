import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  configuredSupportEmail,
  DEFAULT_SUPPORT_EMAIL,
  isBrandedSupportEmail,
  SUPPORT_EMAIL_DOMAIN
} from "../lib/support.ts";

assert.equal(DEFAULT_SUPPORT_EMAIL, "support@opportunityscanner.ai");
assert.equal(SUPPORT_EMAIL_DOMAIN, "opportunityscanner.ai");
assert.equal(configuredSupportEmail({}), DEFAULT_SUPPORT_EMAIL);
assert.equal(
  configuredSupportEmail({ OPPORTUNITY_SCANNER_CONTACT_EMAIL: " Help@OpportunityScanner.AI " }),
  "help@opportunityscanner.ai"
);
assert.equal(
  configuredSupportEmail({ OPPORTUNITY_SCANNER_CONTACT_EMAIL: "not-an-email" }),
  DEFAULT_SUPPORT_EMAIL
);
assert.equal(
  configuredSupportEmail({ OPPORTUNITY_SCANNER_CONTACT_EMAIL: "founder@gmail.com" }),
  DEFAULT_SUPPORT_EMAIL
);
assert.equal(isBrandedSupportEmail("support@opportunityscanner.ai"), true);
assert.equal(isBrandedSupportEmail("support@subdomain.opportunityscanner.ai"), false);
assert.equal(isBrandedSupportEmail("founder@gmail.com"), false);

const publicSupportSources = await Promise.all([
  "../app/auth/sign-in/page.tsx",
  "../app/opportunities/[id]/page.tsx",
  "../app/privacy/page.tsx",
  "../app/reports/[id]/page.tsx",
  "../app/reports/error.tsx",
  "../lib/transactionalEmail/scanLifecycle.ts"
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
const launchPreflight = await readFile(new URL("./check-launch-env.mjs", import.meta.url), "utf8");

for (const source of publicSupportSources) {
  assert.doesNotMatch(source, /hello@opportunitysystems\.ai|joelleayala\.com|Hi Opportunity Systems/);
  assert.match(source, /configuredSupportEmail/);
}
assert.match(launchPreflight, /isBrandedSupportEmail/);
assert.match(launchPreflight, /must use the opportunityscanner\.ai support domain/);

console.log("Customer support identity checks passed.");
