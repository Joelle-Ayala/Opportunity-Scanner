import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { secureStripeBillingPortalUrl } from "../components/billing-management-state.ts";
import { safeSameOriginRedirect } from "../lib/customer-auth/redirect.ts";
import { compareStoredOpportunitySignals } from "../lib/monitoring/comparison.ts";
import { resolveStoredReportAccess } from "../lib/payments/accessContract.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("keeps unauthenticated sessions local and rejects external post-sign-in redirects", async () => {
  const session = await source("lib/customer-auth/session.ts");
  assert.match(session, /if \(!accessToken && !refreshToken\) return null/);
  assert.match(session, /if \(!refreshToken\) return null/);
  assert.match(session, /CustomerAuthError && \[400, 401, 403\]\.includes\(error\.status\)\) return null/);

  assert.equal(
    safeSameOriginRedirect("/dashboard/compare/scan-id?tab=new", "https://scanner.example.test"),
    "/dashboard/compare/scan-id?tab=new"
  );
  assert.equal(
    safeSameOriginRedirect("https://attacker.example/collect", "https://scanner.example.test", "/dashboard"),
    "/dashboard"
  );
  assert.equal(
    safeSameOriginRedirect("//attacker.example/collect", "https://scanner.example.test", "/dashboard"),
    "/dashboard"
  );
});

test("sign-in uses same-origin PKCE handoff without exposing customer tokens to page code", async () => {
  const [signIn, callback, hashCallback, cookies] = await Promise.all([
    source("app/api/auth/sign-in/route.ts"),
    source("app/auth/callback/route.ts"),
    source("app/api/auth/hash-callback/route.ts"),
    source("lib/customer-auth/cookies.ts")
  ]);

  assert.match(signIn, /isSameOriginRequest\(request, config\.appOrigin\)/);
  assert.match(signIn, /safeSameOriginRedirect/);
  assert.match(signIn, /createPkcePair\(\)/);
  assert.match(signIn, /requestMagicLink/);
  assert.match(signIn, /setPendingAuthCookies/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /exchangeAuthCode\(config, code, codeVerifier\)/);
  assert.match(callback, /setSessionCookies\(response, tokens\)/);
  assert.match(hashCallback, /setSessionCookies/);
  assert.match(cookies, /httpOnly: true/);
  assert.match(cookies, /sameSite: "lax"/);
  assert.doesNotMatch(cookies, /document\.cookie|localStorage|sessionStorage/);
});

test("dashboard, onboarding, report creation, and comparison pages fail closed to sign-in", async () => {
  const pages = [
    ["app/dashboard/page.tsx", /auth\/sign-in\?next=%2Fdashboard/],
    ["app/dashboard/onboarding/page.tsx", /auth\/sign-in\?next=/],
    ["app/dashboard/new/page.tsx", /auth\/sign-in\?next=%2Fdashboard%2Fnew/],
    ["app/dashboard/compare/[scanId]/page.tsx", /auth\/sign-in\?next=/]
  ];

  for (const [path, redirectPattern] of pages) {
    const page = await source(path);
    assert.match(page, /resolveCustomerSession\(/, `${path} must resolve the server session`);
    assert.match(page, /if \(!session\?\.user\.email\) redirect/, `${path} must reject anonymous users`);
    assert.match(page, redirectPattern, `${path} must preserve a safe customer return path`);
    assert.match(page, /ensureCustomerAccount\(session\.user\.id, session\.user\.email\)/);
  }
});

test("monitoring APIs reject anonymous writes and derive ownership from the server session", async () => {
  const [createRoute, mutateRoute] = await Promise.all([
    source("app/api/dashboard/searches/route.ts"),
    source("app/api/dashboard/searches/[searchId]/route.ts")
  ]);

  for (const route of [createRoute, mutateRoute]) {
    assert.match(route, /resolveCustomerSession\(/);
    assert.match(route, /session\.user\.id/);
    assert.doesNotMatch(route, /form\.get\(["'](?:authUserId|customerAccountId|stripeCustomerId)["']\)/);
  }
  assert.match(createRoute, /if \(!session\?\.user\.email\) redirect/);
  assert.match(createRoute, /createMonitoredSearchFromScan\(session\.user\.id, scanId\)/);
  assert.match(mutateRoute, /if \(!session\?\.user\.email\)[\s\S]*NextResponse\.redirect\(signIn, 303\)/);
  assert.match(mutateRoute, /UUID_PATTERN\.test\(params\.searchId\)/);
});

test("dashboard data is account-scoped and browser database roles remain closed", async () => {
  const [repository, schema] = await Promise.all([
    source("lib/dashboard/repository.ts"),
    source("db/customer-dashboard.sql")
  ]);

  assert.match(repository, /UUID_PATTERN\.test\(authUserId\)/);
  assert.match(repository, /auth_user_id: `eq\.\$\{authUserId\}`/);
  assert.match(repository, /customer_scan_ownership[\s\S]*customer_account_id: `eq\.\$\{accountId\}`/);
  assert.match(repository, /customer_report_grant_ownership[\s\S]*customer_account_id: `eq\.\$\{account\.id\}`/);
  assert.match(repository, /customer_monitored_profile_ownership[\s\S]*customer_account_id: `eq\.\$\{accountId\}`/);
  assert.match(schema, /auth_user_id uuid not null unique references auth\.users/);
  assert.match(schema, /alter table customer_scan_ownership enable row level security/);
  assert.match(schema, /revoke all on customer_scan_ownership from anon, authenticated/);
  assert.match(schema, /revoke all on customer_saved_searches from anon, authenticated/);
});

test("monitoring onboarding requires an active plan, owned report, and plan capacity", async () => {
  const [onboarding, repository] = await Promise.all([
    source("app/dashboard/onboarding/page.tsx"),
    source("lib/dashboard/repository.ts")
  ]);

  assert.match(onboarding, /subscriptions\.find\(\(item\) => \["active", "trialing"\]\.includes\(item\.status\)\)/);
  assert.match(onboarding, /subscription\.product === "growth" \? 3 : 1/);
  assert.match(onboarding, /loadDashboardReports\(session\.user\.id\)/);
  assert.match(onboarding, /report\.status === "completed"/);
  assert.match(onboarding, /action="\/api\/dashboard\/searches"/);

  assert.match(repository, /createMonitoredSearchFromScan/);
  assert.match(repository, /customer_scan_ownership[\s\S]*customer_account_id: `eq\.\$\{account\.id\}`[\s\S]*scan_id: `eq\.\$\{scanId\}`/);
  assert.match(repository, /status: "in\.\(active,trialing\)"/);
  assert.match(repository, /subscription\.product === "growth" \? 3 : 1/);
  assert.match(repository, /cadence: subscription\.product === "growth" \? "daily" : "weekly"/);
  assert.match(repository, /customer_monitored_profile_ownership/);
});

test("saved-search edits and controls remain owner-scoped, versioned, and plan-limited", async () => {
  const [route, repository, schema] = await Promise.all([
    source("app/api/dashboard/searches/[searchId]/route.ts"),
    source("lib/dashboard/repository.ts"),
    source("db/customer-dashboard.sql")
  ]);

  for (const action of ["edit", "pause", "resume", "archive", "run"]) {
    assert.match(route, new RegExp(`action === "${action}"`));
  }
  assert.match(route, /loadDashboardSavedSearches\(session\.user\.id\)/);
  assert.match(route, /activeCount >= limit/);
  assert.match(repository, /requireOwnedSavedSearch\(authUserId, savedSearchId\)/);
  assert.match(repository, /customer_saved_searches[\s\S]*customer_account_id: `eq\.\$\{account\.id\}`/);
  assert.match(repository, /version: owned\.version\.version \+ 1/);
  assert.match(repository, /created_by_auth_user_id: authUserId/);
  assert.match(schema, /Saved search versions are immutable/);
});

test("report ownership grants full access only through stored grants or active owned monitoring", async () => {
  let grantLookups = 0;
  assert.equal(
    await resolveStoredReportAccess(false, "91a3e66c-2c07-46cf-ab0c-3768375e050a", async () => {
      grantLookups += 1;
      return true;
    }),
    true
  );
  assert.equal(grantLookups, 1);

  const [access, requestAccess, entitlement, reportPage] = await Promise.all([
    source("lib/payments/access.ts"),
    source("lib/payments/requestAccess.ts"),
    source("lib/payments/customerEntitlement.ts"),
    source("app/reports/[id]/page.tsx")
  ]);
  assert.match(requestAccess, /session\?\.user\.id \?\? null/);
  assert.match(requestAccess, /hasCustomerServerReportAccess\(access, scan, authUserId\)/);
  assert.match(access, /if \(await hasServerReportAccess\(access, scan\)\) return true/);
  assert.match(access, /if \(!authUserId\) return false/);
  assert.match(entitlement, /status: "in\.\(active,trialing\)"/);
  assert.match(entitlement, /customer_monitored_profile_ownership/);
  assert.match(entitlement, /profile\.source_scan_id === scanId \|\| profile\.latest_scan_id === scanId/);
  assert.match(entitlement, /monitoring_runs[\s\S]*scan_id: `eq\.\$\{scanId\}`[\s\S]*status: "eq\.completed"/);
  assert.match(reportPage, /await hasCustomerServerReportAccess\(/);
});

test("scheduled monitoring scans inherit report ownership without client input", async () => {
  const ownership = await source("db/monitoring-report-ownership.sql");
  assert.match(ownership, /security definer/);
  assert.match(ownership, /insert into customer_scan_ownership/);
  assert.match(ownership, /from customer_monitored_profile_ownership ownership/);
  assert.match(ownership, /where ownership\.monitored_profile_id = new\.monitored_profile_id/);
  assert.match(ownership, /after insert on monitoring_runs/);
  assert.match(ownership, /revoke all on function attach_monitoring_scan_to_customer\(\) from public, anon, authenticated/);
});

test("report comparison requires an owned completed run pair and compares only stored rows", async () => {
  const [page, repository] = await Promise.all([
    source("app/dashboard/compare/[scanId]/page.tsx"),
    source("lib/dashboard/repository.ts")
  ]);

  assert.match(page, /loadOwnedMonitoringComparisonPair\(session\.user\.id, params\.scanId\)/);
  assert.match(page, /if \(!pair\) notFound\(\)/);
  assert.match(page, /listScanOpportunitySignals\(pair\.currentScanId\)/);
  assert.match(page, /listScanOpportunitySignals\(pair\.previousScanId\)/);
  assert.match(repository, /customer_monitored_profile_ownership[\s\S]*customer_account_id: `eq\.\$\{account\.id\}`/);
  assert.match(repository, /scan_id: `eq\.\$\{currentScanId\}`/);
  assert.match(repository, /status: "eq\.completed"/);
  assert.match(repository, /monitored_profile_id: `eq\.\$\{currentRun\.monitored_profile_id\}`/);

  const previous = [{
    id: "old",
    opportunity_title: "City workforce training",
    source_name: "City procurement",
    source_url: "https://example.gov/opportunity/7",
    deadline: "2026-08-01",
    show_in_report: true
  }];
  const current = [{ ...previous[0], id: "new", deadline: "2026-09-01" }];
  const result = compareStoredOpportunitySignals(previous, current, new Date("2026-07-12T12:00:00.000Z"));
  assert.equal(result.current[0].status, "changed");
  assert.deepEqual(result.current[0].changes.map((change) => change.field), ["deadline"]);
});

test("billing portal uses the signed-in account customer ID and never trusts a browser customer ID", async () => {
  const [route, handlers, button] = await Promise.all([
    source("app/api/billing-portal/route.ts"),
    source("lib/payments/handlers.ts"),
    source("components/dashboard/billing-portal-button.tsx")
  ]);

  assert.match(route, /resolveCustomerSession\(/);
  assert.match(route, /ensureCustomerAccount\(session\.user\.id, session\.user\.email\)/);
  assert.match(route, /ownedCustomerId: account\.stripe_customer_id/);
  assert.match(route, /code: "AUTHENTICATION_REQUIRED"/);
  assert.match(route, /status: 401/);
  assert.match(handlers, /options\.ownedCustomerId/);
  assert.match(handlers, /createBillingPortalSession\(config\.secretKey, customerId, `\$\{config\.appUrl\}\/dashboard`\)/);
  assert.match(button, /body: "\{\}"/);
  assert.doesNotMatch(button, /customerId|stripeCustomerId|checkoutSessionId/);
  assert.equal(secureStripeBillingPortalUrl("https://billing.stripe.com/p/session/test"), "https://billing.stripe.com/p/session/test");
  assert.equal(secureStripeBillingPortalUrl("https://attacker.example/p/session/test"), null);
});

test("subscription checkout hands the customer to sign-in-protected monitoring onboarding", async () => {
  const [handlers, onboarding, reportPage, dashboard] = await Promise.all([
    source("lib/payments/handlers.ts"),
    source("app/dashboard/onboarding/page.tsx"),
    source("app/reports/[id]/page.tsx"),
    source("app/dashboard/page.tsx")
  ]);

  assert.match(handlers, /dashboard\/onboarding\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(onboarding, /dashboard\/onboarding\?checkout=success/);
  assert.match(reportPage, /showReportMonitorUpsell/);
  assert.match(reportPage, /<ReportMonitorCheckout/);
  assert.doesNotMatch(reportPage, /action="\/api\/dashboard\/searches"/);
  assert.match(dashboard, /\/dashboard\/compare\/\$\{run\.scanId\}/);
  assert.match(dashboard, /<BillingPortalButton \/>/);
});

let passed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`\nPaid customer journey verification passed: ${passed}/${tests.length} checks.`);
console.log("No charge, email, network request, or persistent data write was performed.");
