import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [
  dashboard,
  billingSummary,
  billingPortalButton,
  growthPrompt,
  dashboardOverview,
  savedSearches,
  reportPage,
  pricingPage
] = await Promise.all([
  source("app/dashboard/page.tsx"),
  source("components/dashboard/billing-summary.tsx"),
  source("components/dashboard/billing-portal-button.tsx"),
  source("components/growth-plan-prompt.tsx"),
  source("components/dashboard/dashboard-overview.tsx"),
  source("components/dashboard/saved-search-list.tsx"),
  source("app/reports/[id]/page.tsx"),
  source("app/pricing/page.tsx")
]);

assert.match(dashboard, /subscriptionStatus === "past_due"/);
assert.match(dashboard, /Payment needed to restore monitoring/);
assert.match(dashboard, /Update payment method/);
assert.match(dashboard, /variant="danger"/);
assert.match(dashboard, /subscriptionStatus === "canceling"/);
assert.match(dashboard, /Reports remain available, and monitoring continues until/);
assert.match(dashboard, /Review cancellation/);

assert.match(billingSummary, /\["past_due", "incomplete", "canceling"\]/);
assert.match(billingSummary, /Payment needs attention/);
assert.match(billingSummary, /Your reports remain available/);
assert.match(billingSummary, /renewalLabel \|\| "Your monitoring access is scheduled to end"/);
assert.match(billingPortalButton, /variant\?: "default" \| "danger"/);

assert.match(dashboard, /isMonitorPlan = subscription\?\.product === "monitor"/);
assert.match(dashboard, /capacityUsedCount >= profileLimit/);
assert.match(dashboard, /<GrowthPlanPrompt[\s\S]*context="capacity"/);
assert.match(dashboardOverview, /\{planPrompt\}/);
assert.match(savedSearches, /\{capacityAction\}/);
assert.match(growthPrompt, /Up to 3|three monitored company profiles/i);
assert.match(growthPrompt, /daily/i);
assert.match(growthPrompt, /action: ReactNode/);
assert.match(growthPrompt, /\{action\}/);
assert.doesNotMatch(growthPrompt, /\/pricing|growth-checkout|Start With a Free Scan/);

assert.match(reportPage, /hasActiveMonitorPlan/);
assert.match(reportPage, /<GrowthPlanPrompt[\s\S]*context="report"/);
assert.match(reportPage, /action=\{<BillingPortalButton label="Upgrade to Growth" \/>\}/);
assert.match(dashboard, /action=\{<BillingPortalButton label="Upgrade to Growth" \/>\}/);
assert.match(dashboard, /capacityAction: monitorPlanLimitReached[\s\S]*<BillingPortalButton label="Upgrade to Growth" \/>/);
assert.doesNotMatch(dashboard, /href="\/pricing#growth-checkout"/);
assert.match(pricingPage, /Best fit when you need daily checks, multiple company profiles, or contact enrichment/);

assert.doesNotMatch(growthPrompt, /fetch\(|\/api\/checkout|plan switching/i);
assert.doesNotMatch(billingSummary, /fetch\(|\/api\/checkout/i);

console.log("Subscription retention and contextual Growth UI tests passed.");
