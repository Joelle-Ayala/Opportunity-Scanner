import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { safeSameOriginRedirect } from "../lib/customer-auth/redirect.ts";
import { workspaceCompanyFor } from "../lib/dashboard/workspace-identity.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [dashboard, onboarding, activationProgress, savedSearches, monitoringFeed, dashboardShell, alertPreferences, newReport, billing, effectivePlan, signIn, signInRoute, dashboardLoading, dashboardError, reportLoading, reportError, reportPage, opportunityPage] = await Promise.all([
  source("app/dashboard/page.tsx"),
  source("app/dashboard/onboarding/page.tsx"),
  source("components/dashboard/subscription-activation-progress.tsx"),
  source("components/dashboard/saved-search-list.tsx"),
  source("components/dashboard/monitoring-change-feed.tsx"),
  source("components/dashboard/dashboard-shell.tsx"),
  source("components/dashboard/alert-preferences.tsx"),
  source("app/dashboard/new/page.tsx"),
  source("components/dashboard/billing-summary.tsx"),
  source("lib/dashboard/effectivePlan.ts"),
  source("app/auth/sign-in/page.tsx"),
  source("app/api/auth/sign-in/route.ts"),
  source("app/dashboard/loading.tsx"),
  source("app/dashboard/error.tsx"),
  source("app/reports/loading.tsx"),
  source("app/reports/error.tsx"),
  source("app/reports/[id]/page.tsx"),
  source("app/opportunities/[id]/page.tsx")
]);

assert.match(dashboard, /activeMonitoringPlan\(summary\.billing\)/);
assert.match(effectivePlan, /subscription\.product === "monitor" \|\| subscription\.product === "growth"/);
assert.doesNotMatch(dashboard, /if \(subscription && searches\.length === 0\) redirect\("\/dashboard\/onboarding"\)/);
assert.match(dashboard, /const needsMonitoringSetup = Boolean\(subscription && capacityUsedCount === 0\)/);
assert.match(dashboard, /Your plan is active, but monitoring setup is not complete yet\./);
assert.match(dashboard, />Continue setup<\/a>/);
assert.match(dashboard, /searchParams\?\.tab === "billing" \? "billing"/);
assert.match(dashboard, /searchParams\?\.tab === "pursuits" \? "pursuits" : "overview"/);
assert.match(onboarding, /href="\/dashboard\?tab=billing"/);
assert.match(onboarding, />View account status<\/a>/);
assert.match(onboarding, /summary\.billing\.billingPortalAvailable && subscription\.source === "stripe"/);
assert.match(onboarding, /<SubscriptionActivationProgress nextHref=\{next\} \/>/);
assert.match(activationProgress, /MAX_AUTOMATIC_CHECKS = 5/);
assert.match(activationProgress, /window\.setTimeout/);
assert.match(activationProgress, /Automatic checks are paused/);
assert.match(activationProgress, /router\.refresh\(\)/);
assert.match(activationProgress, /role="status"/);
assert.match(dashboard, />Set up monitoring<\/a>/);
assert.match(dashboard, />View monitoring plans<\/a>/);
assert.match(dashboard, /Pick up where you left off/);
assert.match(dashboard, /Next pursuit action/);
assert.match(dashboard, /pursuits=\{\{ pursuits \}\}/);
assert.match(dashboard, /latestReadyReport/);
assert.match(dashboard, /workspaceCompanyFor\(session\.user\.email, reportRows\)/);
assert.match(dashboard, />Open report<\/DashboardActionLink>/);
assert.match(dashboard, />Refresh report<\/DashboardActionLink>/);
assert.match(dashboard, /label: "Full reports"/);
assert.match(dashboard, /monitoringEmptyMessage: !subscription && latestReadyReport/);
assert.match(dashboard, /showAlerts=\{Boolean\(subscription\)\}/);
assert.match(dashboard, /latestResultsHref:/);
assert.match(dashboard, /comparisonPairsByCurrentScanId/);
assert.match(dashboard, /kind: "none" as const/);
assert.match(dashboard, /kind: "updated" as const/);
assert.match(dashboard, /kind: "closing" as const/);
assert.match(savedSearches, /View latest results/);
assert.match(savedSearches, /search\.runState === "running" \? "Checking\.\.\."/);
assert.match(savedSearches, /router\.replace\("\/dashboard\?tab=saved-searches#saved-searches-title"\)/);
assert.match(monitoringFeed, /none: \{ label: "No new matches"/);
assert.match(dashboardShell, /<OpportunityScannerLogo \/>/);
assert.match(dashboardShell, /flex-wrap items-center justify-between/);
assert.doesNotMatch(dashboardShell, />\s*OS\s*</);
assert.match(alertPreferences, /Changes will apply to future alerts\./);
assert.doesNotMatch(alertPreferences, /delivery claim/);
assert.match(newReport, /hasActiveSubscription/);
assert.match(newReport, /\{hasActiveSubscription \? "Run opportunity scan" : "Run free preview"\}/);
assert.doesNotMatch(newReport, /This run starts as a free preview/);
assert.match(reportPage, /Start with this opportunity/);
assert.match(reportPage, /action="open_opportunity"/);
assert.match(reportPage, /action="open_source"/);
assert.match(opportunityPage, /resolveCustomerPageSession/);
assert.match(opportunityPage, /redirect\(`\/api\/auth\/session\?next=/);

assert.match(dashboard, /subscriptionStatus/);
assert.match(billing, /subscriptionStatus: "active" \| "trialing" \| "canceling" \| "past_due" \| "incomplete" \| "canceled" \| "none"/);
assert.match(billing, /label: "Past due"/);
assert.match(billing, /label: "Activation pending"/);
assert.match(billing, /label: "Cancels at period end"/);
assert.match(billing, /DashboardStatusBadge tone=\{status\.tone\}/);
assert.match(
  dashboard,
  /manageAction: summary\.billing\.billingPortalAvailable && billingSubscription\?\.source === "stripe"[\s\S]*?<BillingPortalButton/
);
assert.match(billing, /hasPaymentMethodData/);
assert.match(billing, /invoices !== undefined/);
assert.doesNotMatch(billing, /No payment method on file/);
assert.doesNotMatch(billing, /No invoices are available yet/);
assert.doesNotMatch(billing, /Plan remains active until changed/);

assert.match(signIn, /const nextPath = searchParams\?\.next \|\| "\/dashboard"/);
assert.match(signInRoute, /safeSameOriginRedirect\(String\(form\.get\("next"\) \|\| ""\), config\.appOrigin\)/);
assert.equal(safeSameOriginRedirect("/reports/scan-123", "https://scanner.example.test", "/dashboard"), "/reports/scan-123");
assert.equal(safeSameOriginRedirect("https://attacker.example/collect", "https://scanner.example.test", "/dashboard"), "/dashboard");

const mixedDemoReports = [
  { companyName: "Jammcard", companyUrl: "https://jammcard.com", status: "ready" },
  { companyName: "SchoolGig", companyUrl: "https://schoolgig.us", status: "ready" }
];
assert.equal(workspaceCompanyFor("joelle@schoolgig.us", mixedDemoReports), "SchoolGig");
assert.equal(workspaceCompanyFor("joelle@reparel.com", [
  ...mixedDemoReports,
  { companyName: "Reparel", companyUrl: "https://reparel.com", status: "ready" }
]), "Reparel");
assert.equal(workspaceCompanyFor("founder@gmail.com", mixedDemoReports), "Jammcard");

assert.match(dashboardLoading, /aria-label="Loading customer workspace"/);
assert.match(reportLoading, /aria-label="Loading opportunity report"/);
for (const errorState of [dashboardError, reportError]) {
  assert.match(errorState, /onClick=\{reset\}/);
  assert.doesNotMatch(errorState, /\{error\.(?:message|stack|digest)\}/);
}
assert.match(dashboardError, /Sign in again/);
assert.match(reportError, /Contact support/);

console.log("Customer experience audit tests passed.");
