import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeEmail,
  normalizeOrigin,
  normalizeUuid,
  parseOptions,
  runProvisioning
} from "./provision-demo-customer.mjs";

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const SCAN_ID = "33333333-3333-4333-8333-333333333333";
const ENTITLEMENT_ID = "55555555-5555-4555-8555-555555555555";
const EMAIL = "joelle@schoolgig.us";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function createFakeSupabase() {
  const state = {
    users: [],
    accounts: [],
    ownership: [],
    entitlements: [],
    entitlementScans: [],
    scans: [{
      id: SCAN_ID,
      company_name: "CivicStage Talent Network",
      company_url: "https://civicstage.example",
      email: EMAIL,
      report_access: "free",
      status: "completed"
    }],
    writes: [],
    authCreationBody: null
  };

  async function fetchImpl(input, init = {}) {
    const url = new URL(input);
    const method = init.method || "GET";
    const path = url.pathname;
    const body = init.body ? JSON.parse(init.body) : null;
    if (method !== "GET") state.writes.push({ method, path });

    if (path === "/auth/v1/admin/users" && method === "GET") {
      return json({ users: state.users });
    }
    if (path === "/auth/v1/admin/users" && method === "POST") {
      state.authCreationBody = body;
      const user = { id: AUTH_USER_ID, email: body.email };
      state.users.push(user);
      return json(user);
    }
    if (path === "/rest/v1/scans" && method === "GET") {
      let rows = state.scans;
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const email = url.searchParams.get("email")?.replace(/^eq\./, "");
      const status = url.searchParams.get("status")?.replace(/^eq\./, "");
      if (id) rows = rows.filter((row) => row.id === id);
      if (email) rows = rows.filter((row) => row.email === email);
      if (status) rows = rows.filter((row) => row.status === status);
      return json(rows);
    }
    if (path === "/rest/v1/customer_accounts" && method === "GET") {
      let rows = state.accounts;
      const email = url.searchParams.get("email")?.replace(/^eq\./, "");
      const authUserId = url.searchParams.get("auth_user_id")?.replace(/^eq\./, "");
      if (email) rows = rows.filter((row) => row.email === email);
      if (authUserId) rows = rows.filter((row) => row.auth_user_id === authUserId);
      return json(rows);
    }
    if (path === "/rest/v1/customer_accounts" && method === "POST") {
      let account = state.accounts.find((row) => row.auth_user_id === body.auth_user_id);
      if (!account) {
        account = { id: ACCOUNT_ID, auth_user_id: body.auth_user_id, email: body.email };
        state.accounts.push(account);
      }
      return json([account]);
    }
    if (path === "/rest/v1/customer_scan_ownership" && method === "GET") {
      const scanFilter = url.searchParams.get("scan_id") || "";
      const exactId = scanFilter.match(/^eq\.(.*)$/)?.[1];
      const inIds = scanFilter.match(/^in\.\((.*)\)$/)?.[1]?.split(",");
      const rows = state.ownership.filter((row) =>
        exactId ? row.scan_id === exactId : !inIds || inIds.includes(row.scan_id)
      );
      return json(rows);
    }
    if (path === "/rest/v1/customer_scan_ownership" && method === "POST") {
      const ownership = { access_level: "free", ...body };
      if (!state.ownership.some((row) => row.scan_id === body.scan_id)) state.ownership.push(ownership);
      return json([ownership]);
    }
    if (path === "/rest/v1/customer_scan_ownership" && method === "PATCH") {
      const accountId = url.searchParams.get("customer_account_id")?.replace(/^eq\./, "");
      const scanId = url.searchParams.get("scan_id")?.replace(/^eq\./, "");
      const changed = state.ownership.filter((row) =>
        row.customer_account_id === accountId && row.scan_id === scanId
      );
      for (const row of changed) row.access_level = body.access_level;
      return json(changed);
    }
    if (path === "/rest/v1/customer_demo_entitlements" && method === "GET") {
      let rows = state.entitlements;
      const accountId = url.searchParams.get("customer_account_id")?.replace(/^eq\./, "");
      const status = url.searchParams.get("status")?.replace(/^eq\./, "");
      if (accountId) rows = rows.filter((row) => row.customer_account_id === accountId);
      if (status) rows = rows.filter((row) => row.status === status);
      return json(rows);
    }
    if (path === "/rest/v1/rpc/grant_customer_demo_entitlement" && method === "POST") {
      let entitlement = state.entitlements.find((row) =>
        row.customer_account_id === body.p_customer_account_id
        && row.status === "active"
        && Date.parse(row.expires_at) > Date.now()
      );
      if (!entitlement) {
        entitlement = {
          id: ENTITLEMENT_ID,
          customer_account_id: body.p_customer_account_id,
          plan: body.p_plan,
          status: "active",
          starts_at: body.p_starts_at,
          expires_at: body.p_expires_at
        };
        state.entitlements.push(entitlement);
      }
      return json([entitlement]);
    }
    if (path === "/rest/v1/rpc/assign_customer_demo_entitlement_scan" && method === "POST") {
      if (!state.entitlementScans.some((row) =>
        row.customer_demo_entitlement_id === body.p_entitlement_id
        && row.scan_id === body.p_scan_id
      )) {
        state.entitlementScans.push({
          customer_demo_entitlement_id: body.p_entitlement_id,
          scan_id: body.p_scan_id
        });
      }
      return json(true);
    }
    return json({ error: "unexpected request" }, 404);
  }

  return { state, fetchImpl };
}

const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  APP_URL: "https://scanner.example.test"
};

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("validates identity, UUIDs, and secure URL origins", () => {
  assert.equal(normalizeEmail(" Demo@Example.com "), "demo@example.com");
  assert.equal(normalizeUuid(SCAN_ID.toUpperCase()), SCAN_ID);
  assert.equal(normalizeOrigin("https://scanner.example.test/", "APP_URL"), "https://scanner.example.test");
  assert.throws(() => normalizeEmail("invalid", "Email"), /valid email/);
  assert.throws(() => normalizeUuid("not-a-uuid"), /valid UUID/);
  assert.throws(() => normalizeOrigin("https://user:secret@example.com", "APP_URL"), /HTTPS origin/);
  assert.throws(() => normalizeOrigin("http://example.com", "APP_URL"), /HTTPS origin/);
});

test("defaults to dry-run and requires at least one explicit scan selector", () => {
  const options = parseOptions(["--email", EMAIL, "--scan-id", SCAN_ID], env);
  assert.equal(options.apply, false);
  assert.deepEqual(options.scanIds, [SCAN_ID]);
  assert.equal(options.expiresInDays, 30);
  assert.throws(() => parseOptions(["--email", EMAIL], env), /scan-id or --scan-email/);
  assert.throws(
    () => parseOptions(["--email", "demo@example.com", "--scan-id", SCAN_ID], env),
    /approved demo recipient allowlist/
  );
  assert.throws(
    () => parseOptions(["--email", EMAIL, "--scan-id", SCAN_ID, "--expires-in-days", "91"], env),
    /between 1 and 90/
  );
  assert.throws(() => parseOptions(["--email", EMAIL, "--scan-id", SCAN_ID, "--unknown"], env), /unsupported/);
  assert.throws(() => parseOptions(["--apply=false", "--email", EMAIL, "--scan-id", SCAN_ID], env), /unsupported/);
});

test("dry-run reads state without creating users, accounts, ownership, or access", async () => {
  const fake = createFakeSupabase();
  const result = await runProvisioning({
    argv: ["--email", EMAIL, "--scan-email", EMAIL],
    env,
    fetchImpl: fake.fetchImpl
  });
  assert.equal(result.mode, "dry-run");
  assert.equal(result.authUser.state, "would_create");
  assert.deepEqual(result.scans.wouldAttachIds, [SCAN_ID]);
  assert.equal(result.demoEntitlement.state, "would_create");
  assert.equal(result.demoEntitlement.plan, "growth");
  assert.equal(result.demoEntitlement.capabilities.contactEnrichment, false);
  assert.equal(result.nextLoginUrl, "https://scanner.example.test/auth/sign-in?next=%2Fdashboard");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${EMAIL}|${env.SUPABASE_SERVICE_ROLE_KEY}`));
  assert.equal(fake.state.writes.length, 0);
});

test("apply provisions an expiring account demo without writing Stripe records", async () => {
  const fake = createFakeSupabase();
  const result = await runProvisioning({
    argv: ["--apply", "--email", EMAIL, "--scan-id", SCAN_ID],
    env,
    fetchImpl: fake.fetchImpl
  });
  assert.equal(result.mode, "applied");
  assert.equal(result.authUser.id, AUTH_USER_ID);
  assert.equal(result.customerAccount.id, ACCOUNT_ID);
  assert.deepEqual(result.scans.attachedIds, [SCAN_ID]);
  assert.equal(result.demoEntitlement.state, "created");
  assert.equal(result.demoEntitlement.id, ENTITLEMENT_ID);
  assert.equal(result.demoEntitlement.capabilities.monitoring, true);
  assert.equal(result.demoEntitlement.capabilities.billingPortal, false);
  assert.ok(
    Date.parse(result.demoEntitlement.expiresAt) > Date.parse(result.demoEntitlement.startsAt)
  );
  assert.deepEqual(fake.state.authCreationBody, { email: EMAIL, email_confirm: false });
  assert.equal(fake.state.scans[0].report_access, "free");
  assert.equal(fake.state.ownership[0].customer_account_id, ACCOUNT_ID);
  assert.equal(fake.state.ownership[0].access_level, "free");
  assert.deepEqual(fake.state.entitlementScans, [{
    customer_demo_entitlement_id: ENTITLEMENT_ID,
    scan_id: SCAN_ID
  }]);
  assert.ok(fake.state.writes.every(({ path }) =>
    [
      "/auth/v1/admin/users",
      "/rest/v1/customer_accounts",
      "/rest/v1/customer_scan_ownership",
      "/rest/v1/rpc/grant_customer_demo_entitlement",
      "/rest/v1/rpc/assign_customer_demo_entitlement_scan"
    ].includes(path)
  ));
  assert.ok(fake.state.writes.every(({ path }) => !path.includes("/stripe_")));

  fake.state.writes.length = 0;
  const repeated = await runProvisioning({
    argv: ["--apply", "--email", EMAIL, "--scan-id", SCAN_ID],
    env,
    fetchImpl: fake.fetchImpl
  });
  assert.equal(repeated.authUser.state, "existing");
  assert.equal(repeated.customerAccount.state, "existing");
  assert.equal(repeated.demoEntitlement.state, "existing");
  assert.deepEqual(repeated.scans.attachedIds, []);
  assert.deepEqual(fake.state.writes, [{
    method: "POST",
    path: "/rest/v1/rpc/assign_customer_demo_entitlement_scan"
  }]);
});

test("allows only the approved company identities for each demo account", async () => {
  for (const company of [
    { email: EMAIL, name: "CivicStage Talent Network", url: "https://civicstage.example" },
    { email: EMAIL, name: "SchoolGig", url: "https://schoolgig.us" },
    { email: "joelle@reparel.com", name: "Reparel", url: "https://reparel.com" }
  ]) {
    const fake = createFakeSupabase();
    fake.state.scans[0].company_name = company.name;
    fake.state.scans[0].company_url = company.url;
    const result = await runProvisioning({
      argv: ["--email", company.email, "--scan-id", SCAN_ID],
      env,
      fetchImpl: fake.fetchImpl
    });
    assert.deepEqual(result.scans.wouldAttachIds, [SCAN_ID]);
    assert.equal(fake.state.writes.length, 0);
  }
});

test("rejects a valid but mismatched company before any demo-account writes", async () => {
  const fake = createFakeSupabase();
  fake.state.scans[0].company_name = "Reparel";
  fake.state.scans[0].company_url = "https://reparel.com";
  await assert.rejects(
    runProvisioning({
      argv: ["--apply", "--email", EMAIL, "--scan-id", SCAN_ID],
      env,
      fetchImpl: fake.fetchImpl
    }),
    /does not match the approved companies/
  );
  assert.equal(fake.state.writes.length, 0);
});

test("rejects Jammcard-like scan names and domains before any demo-account writes", async () => {
  for (const company of [
    { name: "Jamm Card, Inc.", url: "https://example.com" },
    { name: "Music Network", url: "https://members.jamm-card.com/path" }
  ]) {
    const fake = createFakeSupabase();
    fake.state.scans[0].company_name = company.name;
    fake.state.scans[0].company_url = company.url;
    await assert.rejects(
      runProvisioning({
        argv: ["--apply", "--email", EMAIL, "--scan-id", SCAN_ID],
        env,
        fetchImpl: fake.fetchImpl
      }),
      /Jammcard scans are protected customer\/regression data and cannot be attached to a demo account/
    );
    assert.equal(fake.state.writes.length, 0);
  }
});

test("refuses to reassign a scan owned by another customer", async () => {
  const fake = createFakeSupabase();
  fake.state.users.push({ id: AUTH_USER_ID, email: EMAIL });
  fake.state.accounts.push({ id: ACCOUNT_ID, auth_user_id: AUTH_USER_ID, email: EMAIL });
  fake.state.ownership.push({
    customer_account_id: "44444444-4444-4444-8444-444444444444",
    scan_id: SCAN_ID,
    ownership_kind: "claimed"
  });
  await assert.rejects(
    runProvisioning({
      argv: ["--apply", "--email", EMAIL, "--scan-id", SCAN_ID],
      env,
      fetchImpl: fake.fetchImpl
    }),
    /owned by another customer/
  );
  assert.equal(fake.state.writes.length, 0);
});

test("source contains no credential output or billing-table mutations", async () => {
  const source = await readFile(new URL("./provision-demo-customer.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:serviceRoleKey|SUPABASE_SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(source, /(?:insert|update)\("(?:stripe_|monitored_profiles|enrichment_credit)/);
  assert.doesNotMatch(source, /report_access: "unlocked"/);
  assert.doesNotMatch(source, /access_level: "full"/);
  assert.match(source, /grant_customer_demo_entitlement/);
  assert.match(source, /assign_customer_demo_entitlement_scan/);
  assert.match(source, /contact-enrichment credits are not fabricated/);
  assert.match(source, /ALLOWED_DEMO_RECIPIENTS/);
  assert.match(source, /ALLOWED_DEMO_COMPANIES/);
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

console.log(`\nDemo provisioning verification passed: ${passed}/${tests.length} checks.`);
