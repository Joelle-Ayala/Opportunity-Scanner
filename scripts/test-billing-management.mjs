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

const [component, pricingPage, dashboardPage, billingSummary] = await Promise.all([
  readFile(new URL("../components/billing-management.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/dashboard/billing-summary.tsx", import.meta.url), "utf8")
]);

assert.match(component, /fetch\("\/api\/billing-portal"/);
assert.match(component, /body: "\{\}"/);
assert.doesNotMatch(component, /body: JSON\.stringify\(\{ checkoutSessionId/);
assert.match(component, /searchParams\.delete\("session_id"\)/);
assert.match(component, /aria-live="polite"/);
assert.match(component, /role="alert"/);
assert.doesNotMatch(component, /\{sessionId\}/);
assert.match(pricingPage, /checkoutSessionId=\{searchParams\?\.session_id\}/);

for (const state of ["past_due", "incomplete", "canceling", "canceled"]) {
  assert.match(billingSummary, new RegExp(`${state}:`), `billing summary must render ${state}`);
}
assert.match(billingSummary, /label: "Past due"/);
assert.match(billingSummary, /label: "Activation pending"/);
assert.match(billingSummary, /label: "Cancels at period end"/);
assert.match(billingSummary, /label: "Canceled"/);
assert.match(billingSummary, /Monitoring is paused until the payment issue is resolved/);
assert.match(dashboardPage, /subscription\.status === "past_due" \|\| subscription\.status === "unpaid"/);
assert.match(dashboardPage, /subscription\.status === "incomplete" \|\| subscription\.status === "paused"/);
assert.match(dashboardPage, /\["active", "trialing"\]\.includes\(subscription\.status\) && subscription\.cancelAtPeriodEnd/);
assert.match(dashboardPage, /const activeMonitorCount = subscription \? summary\.activeMonitorCount : 0/);
assert.match(dashboardPage, /search\.monitoredProfile\?\.status === "active" && subscription/);
assert.match(
  dashboardPage,
  /manageAction: summary\.billing\.stripeCustomerId[\s\S]*<BillingPortalButton/,
  "customers with a Stripe customer record must retain billing portal access"
);
assert.match(dashboardPage, /label=\{subscriptionStatus === "past_due" \? "Update payment method"/);
assert.match(dashboardPage, /variant=\{subscriptionStatus === "past_due" \? "danger" : "default"\}/);
assert.doesNotMatch(dashboardPage, /manageAction: subscription \?/);

console.log("Billing management tests passed.");
