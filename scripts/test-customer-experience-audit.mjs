import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { safeSameOriginRedirect } from "../lib/customer-auth/redirect.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [dashboard, onboarding, billing, signIn, signInRoute, dashboardLoading, dashboardError, reportLoading, reportError] = await Promise.all([
  source("app/dashboard/page.tsx"),
  source("app/dashboard/onboarding/page.tsx"),
  source("components/dashboard/billing-summary.tsx"),
  source("app/auth/sign-in/page.tsx"),
  source("app/api/auth/sign-in/route.ts"),
  source("app/dashboard/loading.tsx"),
  source("app/dashboard/error.tsx"),
  source("app/reports/loading.tsx"),
  source("app/reports/error.tsx")
]);

assert.match(dashboard, /item\.product === "monitor" \|\| item\.product === "growth"/);
assert.doesNotMatch(dashboard, /if \(subscription && searches\.length === 0\) redirect\("\/dashboard\/onboarding"\)/);
assert.match(dashboard, /const needsMonitoringSetup = Boolean\(subscription && capacityUsedCount === 0\)/);
assert.match(dashboard, /Your plan is active, but monitoring setup is not complete yet\./);
assert.match(dashboard, />Continue setup<\/a>/);
assert.match(dashboard, /searchParams\?\.tab === "billing" \? "billing" : "overview"/);
assert.match(onboarding, /href="\/dashboard\?tab=billing"/);
assert.match(onboarding, />View account status<\/a>/);
assert.match(onboarding, /summary\.billing\.stripeCustomerId \? <BillingPortalButton \/>/);
assert.match(dashboard, />Set up monitoring<\/a>/);
assert.match(dashboard, />View monitoring plans<\/a>/);

assert.match(dashboard, /subscriptionStatus/);
assert.match(billing, /subscriptionStatus: "active" \| "trialing" \| "canceling" \| "past_due" \| "incomplete" \| "canceled" \| "none"/);
assert.match(billing, /label: "Past due"/);
assert.match(billing, /label: "Activation pending"/);
assert.match(billing, /label: "Cancels at period end"/);
assert.match(billing, /DashboardStatusBadge tone=\{status\.tone\}/);
assert.match(dashboard, /summary\.billing\.stripeCustomerId \? <BillingPortalButton \/>/);
assert.match(billing, /hasPaymentMethodData/);
assert.match(billing, /invoices !== undefined/);
assert.doesNotMatch(billing, /No payment method on file/);
assert.doesNotMatch(billing, /No invoices are available yet/);
assert.doesNotMatch(billing, /Plan remains active until changed/);

assert.match(signIn, /const nextPath = searchParams\?\.next \|\| "\/dashboard"/);
assert.match(signInRoute, /safeSameOriginRedirect\(String\(form\.get\("next"\) \|\| ""\), config\.appOrigin\)/);
assert.equal(safeSameOriginRedirect("/reports/scan-123", "https://scanner.example.test", "/dashboard"), "/reports/scan-123");
assert.equal(safeSameOriginRedirect("https://attacker.example/collect", "https://scanner.example.test", "/dashboard"), "/dashboard");

assert.match(dashboardLoading, /aria-label="Loading customer workspace"/);
assert.match(reportLoading, /aria-label="Loading opportunity report"/);
for (const errorState of [dashboardError, reportError]) {
  assert.match(errorState, /onClick=\{reset\}/);
  assert.doesNotMatch(errorState, /\{error\.(?:message|stack|digest)\}/);
}
assert.match(dashboardError, /Sign in again/);
assert.match(reportError, /Contact support/);

console.log("Customer experience audit tests passed.");
