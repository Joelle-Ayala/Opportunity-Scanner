import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { claimActiveReportPurchasesByVerifiedEmail } from "../lib/payments/persistence.ts";

const AUTH_USER_ID = "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9";
const ACCOUNT_ID = "1dc2bbaf-6e76-4a84-8e2f-d190b6580f78";
const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};

Object.assign(process.env, {
  SUPABASE_URL: "https://database.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-recovery-test"
});

const rpcCalls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/rpc/claim_active_report_purchases_by_verified_email")) {
    rpcCalls.push(JSON.parse(String(init.body)));
    return Response.json(2);
  }
  return new Response("unexpected request", { status: 500 });
};

try {
  const claimed = await claimActiveReportPurchasesByVerifiedEmail({
    authUserId: AUTH_USER_ID,
    accountId: ACCOUNT_ID
  });
  assert.equal(claimed, 2);
  assert.deepEqual(rpcCalls, [{
    p_auth_user_id: AUTH_USER_ID,
    p_customer_account_id: ACCOUNT_ID,
    p_scan_id: null
  }]);
} finally {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const [migration, manifestSource, repository, persistence] = await Promise.all([
  readFile(new URL("../db/repeat-report-purchase-recovery.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/migration-manifest.json", import.meta.url), "utf8"),
  readFile(new URL("../lib/dashboard/repository.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8")
]);
const manifest = JSON.parse(manifestSource);
const entry = manifest.migrations.find((migrationEntry) => migrationEntry.version === "v0026");

assert.deepEqual(entry, {
  version: "v0026",
  file: "db/repeat-report-purchase-recovery.sql",
  description: "Verified-email recovery for all active one-time Report purchases across Stripe customers.",
  prerequisites: ["v0024"],
  sha256: createHash("sha256").update(migration).digest("hex"),
  requiredInProduction: true
});

assert.match(migration, /join auth\.users auth_user/);
assert.match(migration, /auth_user\.email_confirmed_at is not null/);
assert.match(migration, /lower\(btrim\(auth_user\.email\)\) = account\.email/);
assert.match(migration, /report_grant\.status = 'active'/);
assert.match(migration, /report_grant\.purchase_email = v_account_email/);
assert.match(migration, /p_scan_id is null or report_grant\.scan_id = p_scan_id/);
assert.match(migration, /grant_ownership\.customer_account_id <> p_customer_account_id/);
assert.match(migration, /scan_ownership\.customer_account_id <> p_customer_account_id/);
assert.doesNotMatch(migration, /v_account_customer_id|stripe_customer_id\s*=/);
assert.match(migration, /'claimed',[\s\S]*'free'/);
assert.match(migration, /claim_active_report_purchase_by_email[\s\S]*claim_active_report_purchases_by_verified_email/);
assert.match(repository, /await claimActiveReportPurchasesByVerifiedEmail\(\{/);
assert.match(persistence, /p_scan_id: null/);

console.log("Repeat Report purchase recovery checks passed.");
