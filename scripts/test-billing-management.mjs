import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  completedSubscriptionCheckoutSession,
  secureStripeBillingPortalUrl
} from "../components/billing-management-state.ts";

assert.equal(
  completedSubscriptionCheckoutSession("success", "cs_test_completed123"),
  "cs_test_completed123"
);
assert.equal(
  completedSubscriptionCheckoutSession("success", "  cs_live_completed456  "),
  "cs_live_completed456"
);

for (const [checkout, sessionId] of [
  [undefined, "cs_test_completed123"],
  ["cancelled", "cs_test_completed123"],
  ["success", undefined],
  ["success", ""],
  ["success", "cus_not_allowed"],
  ["success", "cs_test_bad-value"],
  ["success", ["cs_test_completed123"]]
]) {
  assert.equal(completedSubscriptionCheckoutSession(checkout, sessionId), null);
}

assert.equal(
  secureStripeBillingPortalUrl("https://billing.stripe.com/p/session/test"),
  "https://billing.stripe.com/p/session/test"
);
for (const value of [
  undefined,
  "not a URL",
  "http://billing.stripe.com/p/session/test",
  "https://billing.stripe.com.attacker.example/session",
  "https://checkout.stripe.com/session"
]) {
  assert.equal(secureStripeBillingPortalUrl(value), null);
}

const [component, pricingPage] = await Promise.all([
  readFile(new URL("../components/billing-management.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8")
]);

assert.match(component, /fetch\("\/api\/billing-portal"/);
assert.match(component, /body: "\{\}"/);
assert.doesNotMatch(component, /body: JSON\.stringify\(\{ checkoutSessionId/);
assert.match(component, /searchParams\.delete\("session_id"\)/);
assert.match(component, /aria-live="polite"/);
assert.match(component, /role="alert"/);
assert.doesNotMatch(component, /\{sessionId\}/);
assert.match(pricingPage, /checkoutSessionId=\{searchParams\?\.session_id\}/);

console.log("Billing management tests passed.");
