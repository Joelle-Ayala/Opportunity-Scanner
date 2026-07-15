import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { safeSameOriginRedirect } from "../lib/customer-auth/redirect.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [dashboard, billing, signIn, signInRoute] = await Promise.all([
  source("app/dashboard/page.tsx"),
  source("components/dashboard/billing-summary.tsx"),
  source("app/auth/sign-in/page.tsx"),
  source("app/api/auth/sign-in/route.ts")
]);

assert.match(dashboard, /item\.product === "monitor" \|\| item\.product === "growth"/);
assert.match(dashboard, /if \(subscription && searches\.length === 0\) redirect\("\/dashboard\/onboarding"\)/);
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

console.log("Customer experience audit tests passed.");
