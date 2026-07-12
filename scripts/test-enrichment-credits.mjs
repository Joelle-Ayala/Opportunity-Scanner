import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  contactEnrichmentIdempotencyKey,
  growthEnrichmentCreditLimit,
  requireReservedEnrichmentCredit
} from "../lib/enrichmentCreditContract.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("uses a bounded server-side Growth allowance and stable opportunity key", () => {
  const previous = process.env.ENRICHMENT_CREDITS_GROWTH_MONTHLY;
  process.env.ENRICHMENT_CREDITS_GROWTH_MONTHLY = "45";
  assert.equal(growthEnrichmentCreditLimit(), 45);
  process.env.ENRICHMENT_CREDITS_GROWTH_MONTHLY = "99999";
  assert.equal(growthEnrichmentCreditLimit(), 10000);
  process.env.ENRICHMENT_CREDITS_GROWTH_MONTHLY = previous;

  const key = contactEnrichmentIdempotencyKey(
    "91a3e66c-2c07-46cf-ab0c-3768375e050a",
    "1ac3e66c-2c07-46cf-ab0c-3768375e050b"
  );
  assert.equal(
    key,
    "contact-enrichment:v1:91a3e66c-2c07-46cf-ab0c-3768375e050a:1ac3e66c-2c07-46cf-ab0c-3768375e050b"
  );
});

test("allows reserved and idempotently reserved credits but rejects exhausted balances", () => {
  assert.doesNotThrow(() => requireReservedEnrichmentCredit({ status: "reserved", limit: 30, used: 1, remaining: 29 }));
  assert.doesNotThrow(() => requireReservedEnrichmentCredit({ status: "already_reserved", limit: 30, used: 1, remaining: 29 }));
  assert.throws(
    () => requireReservedEnrichmentCredit({ status: "limit_reached", limit: 30, used: 30, remaining: 0 }),
    /No contact-enrichment credits remain/
  );
});

test("migration enforces atomic, monthly, owner-scoped and append-only accounting", async () => {
  const migration = await source("db/enrichment-credits.sql");
  assert.match(migration, /unique \(customer_account_id, period_start, idempotency_key\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /product = 'growth'/);
  assert.match(migration, /status in \('active', 'trialing'\)/);
  assert.match(migration, /customer_scan_ownership/);
  assert.match(migration, /scan_opportunities/);
  assert.match(migration, /v_used >= p_credit_limit/);
  assert.match(migration, /make_interval\(months => v_month_offset \+ 1\)/);
  assert.match(migration, /grant select on enrichment_credit_ledger to service_role/);
  assert.doesNotMatch(migration, /grant (?:all|insert|update|delete) on enrichment_credit_ledger to service_role/);
  assert.match(migration, /revoke all on function reserve_enrichment_credit[\s\S]*from public, anon, authenticated/);
});

test("all paid provider entry points reserve before contact enrichment", async () => {
  const [service, contact, route, exportRoute] = await Promise.all([
    source("lib/enrichmentCredits.ts"),
    source("lib/contactEnrichment.ts"),
    source("app/api/opportunities/enrich/route.ts"),
    source("app/api/reports/[id]/outreach-package/route.ts")
  ]);
  assert.match(service, /supabaseRpc<EnrichmentCreditReservation>\("reserve_enrichment_credit"/);
  assert.match(contact, /await input\.reserveProviderCredit\(\)[\s\S]*enrichContactsWithClay/);
  assert.ok(contact.indexOf("hasSourceNativeContact") < contact.indexOf("await input.reserveProviderCredit()"));
  assert.ok(contact.indexOf("hasConfiguredContactProvider()") < contact.indexOf("await input.reserveProviderCredit()"));
  assert.match(route, /resolveRequestReportAccess[\s\S]*reserveContactEnrichmentCredit/);
  assert.match(exportRoute, /reserveProviderCredit:[\s\S]*reserveContactEnrichmentCredit/);
  assert.match(exportRoute, /Credit exhaustion must not block export/);
});

test("dashboard exposes an explicit remaining-credit balance", async () => {
  const [page, repository, usage, env] = await Promise.all([
    source("app/dashboard/page.tsx"),
    source("lib/dashboard/repository.ts"),
    source("components/dashboard/usage-summary.tsx"),
    source(".env.example")
  ]);
  assert.match(repository, /loadEnrichmentCreditBalance\(authUserId\)/);
  assert.match(page, /summary\.enrichmentCredits\.remaining/);
  assert.match(usage, /remaining of/);
  assert.match(env, /ENRICHMENT_CREDITS_GROWTH_MONTHLY=30/);
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

console.log(`\nEnrichment credit verification passed: ${passed}/${tests.length} checks.`);
