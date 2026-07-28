import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");
const NOW = new Date("2026-07-24T12:00:00.000Z");

const activeEntitlement = {
  id: "11111111-1111-4111-8111-111111111111",
  customer_account_id: "22222222-2222-4222-8222-222222222222",
  plan: "growth",
  status: "active",
  starts_at: "2026-07-23T12:00:00.000Z",
  expires_at: "2026-08-23T12:00:00.000Z"
};

function entitlementIsActive(entitlement, now) {
  const startsAt = Date.parse(entitlement.starts_at);
  const expiresAt = Date.parse(entitlement.expires_at);
  return entitlement.plan === "growth"
    && entitlement.status === "active"
    && Number.isFinite(startsAt)
    && Number.isFinite(expiresAt)
    && startsAt <= now.getTime()
    && expiresAt > now.getTime();
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("demo entitlement activation fails closed for future, expired, and revoked rows", () => {
  assert.equal(entitlementIsActive(activeEntitlement, NOW), true);
  assert.equal(entitlementIsActive({
    ...activeEntitlement,
    starts_at: "2026-07-25T12:00:00.000Z"
  }, NOW), false);
  assert.equal(entitlementIsActive({
    ...activeEntitlement,
    expires_at: NOW.toISOString()
  }, NOW), false);
  assert.equal(entitlementIsActive({
    ...activeEntitlement,
    status: "revoked"
  }, NOW), false);
  assert.equal(entitlementIsActive({
    ...activeEntitlement,
    expires_at: "not-a-date"
  }, NOW), false);
});

test("migration keeps demos account-scoped, auditable, revocable, and service-only", async () => {
  const sql = await source("db/customer-demo-entitlements.sql");

  assert.match(sql, /create table if not exists public\.customer_demo_entitlements/);
  assert.match(sql, /customer_account_id uuid not null[\s\S]*references public\.customer_accounts/);
  assert.match(sql, /plan text not null check \(plan = 'growth'\)/);
  assert.match(sql, /status in \('active', 'expired', 'revoked'\)/);
  assert.match(sql, /starts_at timestamptz not null/);
  assert.match(sql, /expires_at timestamptz not null/);
  assert.match(sql, /created_by text not null/);
  assert.match(sql, /note text not null/);
  assert.match(sql, /expires_at <= starts_at \+ interval '90 days'/);
  assert.match(sql, /revoke all on table public\.customer_demo_entitlements[\s\S]*service_role/);
  assert.match(sql, /grant select on table public\.customer_demo_entitlements to service_role/);
  assert.match(sql, /grant_customer_demo_entitlement/);
  assert.match(sql, /revoke_customer_demo_entitlement/);
  assert.match(sql, /grant execute on function public\.grant_customer_demo_entitlement[\s\S]*to service_role/);
  assert.match(sql, /grant execute on function public\.revoke_customer_demo_entitlement[\s\S]*to service_role/);
  assert.match(sql, /create table if not exists public\.customer_demo_entitlement_scans/);
  assert.match(sql, /assign_customer_demo_entitlement_scan/);
  assert.match(sql, /grant execute on function public\.assign_customer_demo_entitlement_scan[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /insert into public\.stripe_|update public\.stripe_/);
});

test("monitoring requires exactly one truthful billing source and rechecks demo expiry", async () => {
  const sql = await source("db/customer-demo-entitlements.sql");

  assert.match(
    sql,
    /num_nonnulls\(stripe_customer_id, customer_demo_entitlement_id\) = 1/
  );
  assert.match(
    sql,
    /ownership\.customer_account_id = entitlement\.customer_account_id/
  );
  assert.match(sql, /entitlement\.status = 'active'/);
  assert.match(sql, /entitlement\.starts_at <= now\(\)/);
  assert.match(sql, /entitlement\.expires_at > now\(\)/);
  assert.match(sql, /subscription\.livemode = true/);
  assert.match(
    sql,
    /claim_due_monitored_profiles[\s\S]*monitored_profile_has_active_plan\(profile\.id\)/
  );
  assert.match(
    sql,
    /claim_monitored_profile_by_id[\s\S]*monitored_profile_has_active_plan\(profile\.id\)/
  );
  assert.match(
    sql,
    /start_monitoring_profile_run[\s\S]*monitored_profile_has_active_plan\(profile\.id\)/
  );
  assert.match(
    sql,
    /complete_monitoring_profile_run[\s\S]*subscription\.livemode = true[\s\S]*for share of subscription/
  );
  assert.match(
    sql,
    /complete_monitoring_profile_run[\s\S]*entitlement\.expires_at > now\(\)[\s\S]*for share of entitlement[\s\S]*record_monitoring_alerts/
  );
  assert.match(
    sql,
    /claim_pending_monitoring_alerts[\s\S]*public\.monitored_profile_has_active_plan\(profile\.id\)/
  );
  assert.match(
    sql,
    /create_customer_monitored_search[\s\S]*customer_demo_entitlement_scans[\s\S]*customer_demo_entitlement_id/
  );
});

test("server report and monitoring access stays owner-bound and checks approved demo scans", async () => {
  const entitlement = await source("lib/payments/customerEntitlement.ts");

  assert.match(
    entitlement,
    /isActiveCustomerDemoEntitlement[\s\S]*status !== "active"[\s\S]*startsAt <= nowMs[\s\S]*expiresAt > nowMs/
  );
  assert.match(
    entitlement,
    /"customer_demo_entitlements"[\s\S]*customer_account_id: `eq\.\$\{accountId\}`/
  );
  assert.match(
    entitlement,
    /"customer_demo_entitlement_scans"[\s\S]*customer_demo_entitlement_id: `eq\.\$\{demoEntitlement\.id\}`[\s\S]*scan_id: `eq\.\$\{scanId\}`/
  );
  assert.match(
    entitlement,
    /Boolean\(profile\.customer_demo_entitlement_id\)[\s\S]*demoScanIds\.has\(profile\.source_scan_id\)/
  );
  assert.match(entitlement, /livemode: "eq\.true"/);
  assert.match(entitlement, /expires_at: `gt\.\$\{timestamp\}`/);
  assert.match(entitlement, /status: "eq\.active"/);
});

test("dashboard exposes demo source, expiry, capabilities, and no billing portal", async () => {
  const [types, repository, effectivePlan, dashboard, onboarding, report] = await Promise.all([
    source("lib/dashboard/types.ts"),
    source("lib/dashboard/repository.ts"),
    source("lib/dashboard/effectivePlan.ts"),
    source("app/dashboard/page.tsx"),
    source("app/dashboard/onboarding/page.tsx"),
    source("app/reports/[id]/page.tsx")
  ]);

  assert.match(types, /source: "demo"/);
  assert.match(types, /expiresAt: string/);
  assert.match(types, /contactEnrichment: false/);
  assert.match(types, /billingPortal: false/);
  assert.match(types, /billingPortalAvailable: boolean/);
  assert.match(repository, /demoPlan: demoEntitlement/);
  assert.match(repository, /billingPortalAvailable: Boolean\(account\.stripe_customer_id\)/);
  assert.match(repository, /entitlementActive:/);
  assert.match(effectivePlan, /source: "demo"/);
  assert.match(effectivePlan, /currentPeriodEnd: billing\.demoPlan\.expiresAt/);
  assert.match(dashboard, /planLabel: demoPlan \? "Demo access" : "Subscription"/);
  assert.match(onboarding, /activeMonitoringPlan\(summary\.billing\)/);
  assert.match(report, /hasActiveGrowthPlan = dashboardSummary\?\.enrichmentCredits\.entitled === true/);
});

test("v0034 manifest checksum and append order match the migration", async () => {
  const [manifestSource, sql] = await Promise.all([
    source("db/migration-manifest.json"),
    source("db/customer-demo-entitlements.sql")
  ]);
  const manifest = JSON.parse(manifestSource);
  const entry = manifest.migrations.find(({ version }) => version === "v0034");

  assert.ok(entry);
  assert.equal(entry.version, "v0034");
  assert.equal(entry.file, "db/customer-demo-entitlements.sql");
  assert.deepEqual(entry.prerequisites, ["v0033"]);
  assert.equal(entry.sha256, createHash("sha256").update(sql).digest("hex"));
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

console.log(`\nDemo entitlement verification passed: ${passed}/${tests.length} checks.`);
