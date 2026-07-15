import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isMatchingPaidReportSession,
  resolveStoredReportAccess,
  verifiedPaidSubscriptionCheckout
} from "../lib/payments/accessContract.ts";
import {
  accessSuffix,
  hasAdminAccess,
  hasFullReportAccess,
  reportAccessHref
} from "../lib/access.ts";
import { fulfillVerifiedReportCheckout } from "../lib/payments/persistence.ts";

const SCAN_ID = "91a3e66c-2c07-46cf-ab0c-3768375e050a";
const PRICE_ID = "price_report_server";

function paidSession(overrides = {}) {
  return {
    id: "cs_test_report123",
    status: "complete",
    mode: "payment",
    payment_status: "paid",
    amount_total: 4900,
    currency: "usd",
    created: 1_750_000_000,
    livemode: false,
    customer: "cus_reportbuyer",
    customer_details: { email: "buyer@example.com" },
    payment_intent: {
      id: "pi_reportpayment",
      latest_charge: {
        id: "ch_reportcharge",
        refunded: false,
        amount_refunded: 0
      }
    },
    metadata: {
      product: "report",
      scan_id: SCAN_ID,
      price_id: PRICE_ID
    },
    ...overrides
  };
}

function paidSubscriptionSession(overrides = {}) {
  return {
    id: "cs_test_subscription123",
    created: 1_750_000_000,
    livemode: false,
    status: "complete",
    mode: "subscription",
    payment_status: "paid",
    customer: "cus_customer123",
    customer_details: { email: "buyer@example.com" },
    metadata: {
      product: "monitor",
      billing_interval: "monthly",
      price_id: "price_monitor_monthly"
    },
    line_items: {
      has_more: false,
      data: [{ quantity: 1, price: { id: "price_monitor_monthly" } }]
    },
    subscription: {
      id: "sub_subscription123",
      customer: "cus_customer123",
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [{
          price: { id: "price_monitor_monthly" },
          current_period_start: 1_750_000_000,
          current_period_end: 1_752_592_000
        }]
      }
    },
    ...overrides
  };
}

const subscriptionPrices = {
  monitorMonthly: "price_monitor_monthly",
  monitorAnnual: "price_monitor_annual",
  growthMonthly: "price_growth_monthly",
  growthAnnual: "price_growth_annual"
};

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("preserves legacy admin and report-code access without querying billing", async () => {
  let queries = 0;
  const granted = await resolveStoredReportAccess(true, null, SCAN_ID, async () => {
    queries += 1;
    return false;
  });
  assert.equal(granted, true);
  assert.equal(queries, 0);
});

test("disables production legacy URL codes and propagation unless the emergency override is explicit", () => {
  const names = [
    "NODE_ENV",
    "OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE",
    "OPPORTUNITY_SCANNER_ADMIN_CODE",
    "OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION"
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const reportCode = "report-code-with-at-least-thirty-two-characters";
  const adminCode = "admin-code-with-at-least-thirty-two-characters";

  try {
    process.env.NODE_ENV = "development";
    process.env.OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE = reportCode;
    process.env.OPPORTUNITY_SCANNER_ADMIN_CODE = adminCode;
    delete process.env.OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION;
    assert.equal(hasFullReportAccess(reportCode), true);
    assert.equal(hasAdminAccess(adminCode), true);
    assert.match(reportAccessHref("/reports/scan", reportCode), /access=/);

    process.env.NODE_ENV = "production";
    assert.equal(hasFullReportAccess(reportCode), false);
    assert.equal(hasAdminAccess(adminCode), false);
    assert.equal(accessSuffix(reportCode), "");
    assert.equal(reportAccessHref("/reports/scan", reportCode), "/reports/scan");
    assert.equal(hasFullReportAccess(undefined, { report_access: "unlocked" }), true);
    assert.equal(hasAdminAccess(undefined, { report_access: "admin" }), true);

    process.env.OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION = "true";
    assert.equal(hasFullReportAccess(reportCode), true);
    assert.equal(hasAdminAccess(adminCode), true);
    assert.match(accessSuffix(reportCode), /access=/);

    process.env.OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE = "too-short";
    assert.equal(hasFullReportAccess("too-short"), false);
    assert.equal(accessSuffix("too-short"), "");
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("recognizes only an active account-owned scan grant and fails closed for anonymous buyers", async () => {
  const authUserId = "f018c793-41fc-4df7-ab85-8f7dd684f8ef";
  assert.equal(
    await resolveStoredReportAccess(false, authUserId, SCAN_ID, async (ownerId, scanId) => (
      ownerId === authUserId && scanId === SCAN_ID
    )),
    true
  );
  let anonymousQueries = 0;
  assert.equal(await resolveStoredReportAccess(false, null, SCAN_ID, async () => {
    anonymousQueries += 1;
    return true;
  }), false);
  assert.equal(anonymousQueries, 0);
  assert.equal(await resolveStoredReportAccess(false, authUserId, SCAN_ID, async () => false), false);
  assert.equal(
    await resolveStoredReportAccess(false, authUserId, SCAN_ID, async () => {
      throw new Error("private database failure");
    }),
    false
  );
});

test("accepts a paid Report session by exact server Price without a hardcoded amount", () => {
  assert.equal(isMatchingPaidReportSession(paidSession(), SCAN_ID, PRICE_ID), true);
  const rejected = [
    paidSession({ status: "open" }),
    paidSession({ mode: "subscription" }),
    paidSession({ payment_status: "unpaid" }),
    paidSession({ customer: "not-a-customer" }),
    paidSession({ customer_details: { email: "invalid" } }),
    paidSession({ payment_intent: "pi_unexpanded" }),
    paidSession({
      payment_intent: {
        id: "pi_reportpayment",
        latest_charge: { id: "ch_reportcharge", refunded: true, amount_refunded: 4900 }
      }
    }),
    paidSession({ metadata: { ...paidSession().metadata, product: "growth" } }),
    paidSession({ metadata: { ...paidSession().metadata, scan_id: "another-scan" } }),
    paidSession({ metadata: { ...paidSession().metadata, price_id: "price_client_controlled" } })
  ];
  for (const session of rejected) {
    assert.equal(isMatchingPaidReportSession(session, SCAN_ID, PRICE_ID), false);
  }
});

test("production handoffs accept only live Checkout session objects", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "test";
    assert.equal(isMatchingPaidReportSession(paidSession(), SCAN_ID, PRICE_ID), true);
    assert.ok(
      verifiedPaidSubscriptionCheckout(
        paidSubscriptionSession(),
        "buyer@example.com",
        subscriptionPrices
      )
    );

    process.env.NODE_ENV = "production";
    assert.equal(isMatchingPaidReportSession(paidSession(), SCAN_ID, PRICE_ID), false);
    assert.equal(
      isMatchingPaidReportSession(
        paidSession({ id: "cs_live_report123", livemode: true }),
        SCAN_ID,
        PRICE_ID
      ),
      true
    );
    assert.equal(
      verifiedPaidSubscriptionCheckout(
        paidSubscriptionSession({ livemode: true }),
        "buyer@example.com",
        subscriptionPrices
      ),
      null
    );
    assert.ok(
      verifiedPaidSubscriptionCheckout(
        paidSubscriptionSession({ id: "cs_live_subscription123", livemode: true }),
        "buyer@example.com",
        subscriptionPrices
      )
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("production webhook persistence requires live event and object mode before billing writes", async () => {
  const [config, persistence, migration] = await Promise.all([
    readFile(new URL("../lib/payments/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/stripe-live-mode-enforcement.sql", import.meta.url), "utf8")
  ]);
  assert.match(config, /requireLivemode/);
  assert.match(persistence, /p_price_catalog: prices/);
  assert.match(migration, /p_payload->'livemode' is distinct from 'true'::jsonb/);
  assert.match(migration, /data,object,livemode/);
  assert.match(migration, /\^cs_live_/);
  assert.match(migration, /process_stripe_webhook_event_unchecked/);
  assert.match(migration, /from public, anon, authenticated, service_role/);
});

test("checkout sends Report buyers to their report while subscriptions enter monitoring onboarding", async () => {
  const handlers = await readFile(new URL("../lib/payments/handlers.ts", import.meta.url), "utf8");
  assert.match(handlers, /const reportPath = `\/reports\/\$\{scanId\}\?checkout=success&session_id=`/);
  assert.match(handlers, /auth\/sign-in\?next=\$\{encodeURIComponent\(reportPath\)\}/);
  assert.match(handlers, /input\.plan === "report"/);
  assert.match(handlers, /\/dashboard\/onboarding\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/);
});

test("paid pages and APIs await the same server-side scan access guard", async () => {
  const paths = [
    "../app/reports/[id]/page.tsx",
    "../app/opportunities/[id]/page.tsx",
    "../app/api/reports/[id]/export/route.ts",
    "../app/api/reports/[id]/outreach-package/route.ts",
    "../app/api/opportunities/enrich/route.ts",
    "../app/api/workflow/send/route.ts"
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const guard = path.includes("app/reports/[id]/page.tsx")
      ? /await hasCustomerServerReportAccess/
      : /await (?:hasRequestReportAccess|resolveRequestReportAccess)/;
    assert.match(source, guard);
  }
});

test("handoff is report-scoped, fulfilled server-side, and not propagated as an API access code", async () => {
  const [reportPage, paymentAccess, accessContract, persistence, stripeApi, handoffSql, ownershipSql] = await Promise.all([
    readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/access.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/accessContract.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/stripeApi.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/stripe-report-access-handoff.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/customer-report-checkout-ownership.sql", import.meta.url), "utf8")
  ]);
  assert.match(
    reportPage,
    /verifyReportCheckoutHandoff\([\s\S]*scan\.id,[\s\S]*searchParams\.session_id,[\s\S]*authUserId: customerSession!\.user\.id,[\s\S]*accountId: customerAccount\.id/
  );
  assert.match(reportPage, /redirect\(reportAccessHref\(`\/reports\/\$\{scan\.id\}`/);
  assert.match(reportPage, /if \(checkoutHandoffFulfilled\)[\s\S]*redirect/);
  assert.doesNotMatch(reportPage, /access=\$\{[^}]*session_id/);
  assert.match(paymentAccess, /isMatchingPaidReportSession\(session, scanId, config\.prices\.report\)/);
  assert.match(paymentAccess, /await dependencies\.fulfillCheckout\(scanId, session, owner\)/);
  assert.match(accessContract, /session\.metadata\?\.scan_id === scanId/);
  assert.doesNotMatch(accessContract, /amount_total === 4900/);
  assert.match(accessContract, /latestCharge\.refunded === false/);
  assert.match(stripeApi, /query\.append\("expand\[\]", expansion\)/);
  assert.match(stripeApi, /"payment_intent\.latest_charge"/);
  assert.match(persistence, /p_customer_email: customerEmail/);
  assert.match(persistence, /SUPABASE_SERVICE_ROLE_KEY|databaseHeaders/);
  assert.match(persistence, /"fulfill_verified_customer_report_checkout"/);
  assert.match(persistence, /p_auth_user_id: account!\.authUserId/);
  assert.match(persistence, /p_customer_account_id: account!\.accountId/);
  assert.match(handoffSql, /on conflict \(stripe_checkout_session_id\) do nothing/);
  assert.match(handoffSql, /p_customer_email text/);
  assert.match(handoffSql, /drop function if exists fulfill_verified_report_checkout\(uuid, text, text, text, timestamptz, boolean\)/);
  assert.match(handoffSql, /and status = 'active'/);
  assert.match(handoffSql, /security definer/);
  assert.match(handoffSql, /grant execute[\s\S]*to service_role/);
  assert.match(ownershipSql, /id = p_customer_account_id[\s\S]*auth_user_id = p_auth_user_id/);
  assert.match(ownershipSql, /insert into customer_report_grant_ownership/);
  assert.match(ownershipSql, /insert into customer_scan_ownership/);
  assert.match(ownershipSql, /on conflict \(scan_id\) do update set[\s\S]*customer_scan_ownership\.customer_account_id = excluded\.customer_account_id/);
  assert.match(ownershipSql, /grant execute on function fulfill_verified_customer_report_checkout[\s\S]*to service_role/);
});

test("verified account handoff sends authenticated ownership to the account-scoped RPC", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let request;
  process.env.SUPABASE_URL = "https://database.example.com";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response("true", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const fulfilled = await fulfillVerifiedReportCheckout(SCAN_ID, paidSession(), {
      authUserId: "f018c793-41fc-4df7-ab85-8f7dd684f8ef",
      accountId: "7582979b-7a9f-4ae9-9ddd-b7ddcc79d830"
    });
    assert.equal(fulfilled, true);
    assert.match(request.url, /\/rest\/v1\/rpc\/fulfill_verified_customer_report_checkout$/);
    const body = JSON.parse(request.init.body);
    assert.equal(body.p_auth_user_id, "f018c793-41fc-4df7-ab85-8f7dd684f8ef");
    assert.equal(body.p_customer_account_id, "7582979b-7a9f-4ae9-9ddd-b7ddcc79d830");
    assert.equal(body.p_scan_id, SCAN_ID);
    assert.equal(body.p_customer_email, "buyer@example.com");

    request = undefined;
    assert.equal(
      await fulfillVerifiedReportCheckout(SCAN_ID, paidSession(), {
        authUserId: "not-a-user",
        accountId: "7582979b-7a9f-4ae9-9ddd-b7ddcc79d830"
      }),
      false
    );
    assert.equal(request, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`\nPayment access verification passed: ${passed}/${tests.length} checks.`);
