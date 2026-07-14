import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveStoredReportAccess } from "../lib/payments/accessContract.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("requires a valid authenticated owner and an exact scan UUID", async () => {
  const entitlement = await source("lib/payments/customerEntitlement.ts");

  assert.match(entitlement, /UUID_PATTERN\.test\(authUserId\)/);
  assert.match(entitlement, /UUID_PATTERN\.test\(scanId\)/);
  assert.match(entitlement, /"customer_accounts"[\s\S]*auth_user_id: `eq\.\$\{authUserId\}`/);
  assert.match(entitlement, /hasActiveCustomerReportGrant/);
  assert.match(entitlement, /customer_report_grant_ownership/);
  assert.match(
    entitlement,
    /"customer_monitored_profile_ownership"[\s\S]*customer_account_id: `eq\.\$\{account\.id\}`/
  );
  assert.doesNotMatch(entitlement, /customer_scan_ownership/);
});

test("accepts only active or trialing Monitor and Growth subscriptions", async () => {
  const entitlement = await source("lib/payments/customerEntitlement.ts");

  assert.match(entitlement, /"stripe_subscriptions"/);
  assert.match(entitlement, /stripe_customer_id: `eq\.\$\{account\.stripe_customer_id\}`/);
  assert.match(entitlement, /status: "in\.\(active,trialing\)"/);
  assert.match(entitlement, /product: "in\.\(monitor,growth\)"/);
  assert.doesNotMatch(entitlement, /past_due|incomplete|canceled|unpaid/);
});

test("limits entitlement to source, latest, or completed scans for owned monitored profiles", async () => {
  const entitlement = await source("lib/payments/customerEntitlement.ts");

  assert.match(entitlement, /const profileIds = ownership\.map/);
  assert.match(entitlement, /if \(profileIds\.length === 0\) return false/);
  assert.match(entitlement, /"monitored_profiles"[\s\S]*id: inFilter\(profileIds\)/);
  assert.match(entitlement, /profile\.source_scan_id === scanId \|\| profile\.latest_scan_id === scanId/);
  assert.match(entitlement, /"monitoring_runs"/);
  assert.match(entitlement, /monitored_profile_id: inFilter\(profileIds\)/);
  assert.match(entitlement, /scan_id: `eq\.\$\{scanId\}`/);
  assert.match(entitlement, /status: "eq\.completed"/);
});

test("preserves legacy and one-time report access before subscription lookup", async () => {
  let billingQueries = 0;
  assert.equal(
    await resolveStoredReportAccess(true, null, "91a3e66c-2c07-46cf-ab0c-3768375e050a", async () => {
      billingQueries += 1;
      return false;
    }),
    true
  );
  assert.equal(billingQueries, 0);

  const access = await source("lib/payments/access.ts");
  assert.match(access, /resolveStoredReportAccess\(legacyAccess, authUserId, scan\.id/);
  assert.match(access, /hasActiveCustomerReportGrant/);
  assert.match(access, /return await hasActiveCustomerMonitoringEntitlement\(authUserId, scan\.id\)/);
  assert.match(access, /catch \{\s*return false;\s*\}/);
});

test("derives customer identity from the server session and fails closed", async () => {
  const requestAccess = await source("lib/payments/requestAccess.ts");

  assert.match(requestAccess, /resolveCustomerSession\(getCustomerAuthConfig\(requestUrl\), cookies\(\)\)/);
  assert.match(requestAccess, /authUserId = session\?\.user\.id \?\? null/);
  assert.match(requestAccess, /catch \{\s*authUserId = null;\s*\}/);
  assert.match(requestAccess, /hasCustomerServerReportAccess\(access, scan, authUserId\)/);
  const parameters = requestAccess.match(/hasRequestReportAccess\(([\s\S]*?)\n\): Promise<boolean>/)?.[1];
  assert.ok(parameters);
  assert.doesNotMatch(parameters, /authUserId/);
});

test("all paid report surfaces use the request-authenticated entitlement guard", async () => {
  const paths = [
    "app/reports/[id]/page.tsx",
    "app/opportunities/[id]/page.tsx",
    "app/api/reports/[id]/export/route.ts",
    "app/api/reports/[id]/outreach-package/route.ts",
    "app/api/opportunities/enrich/route.ts",
    "app/api/workflow/send/route.ts"
  ];

  for (const path of paths) {
    const paidSurface = await source(path);
    assert.match(
      paidSurface,
      /await (?:hasRequestReportAccess|resolveRequestReportAccess|hasCustomerServerReportAccess)\(/,
      `${path} must authorize through the authenticated customer entitlement guard`
    );
  }
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

console.log(`\nCustomer entitlement verification passed: ${passed}/${tests.length} checks.`);
