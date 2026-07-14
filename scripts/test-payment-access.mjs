import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isMatchingPaidReportSession,
  resolveStoredReportAccess
} from "../lib/payments/accessContract.ts";

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
  const [reportPage, paymentAccess, accessContract, persistence, stripeApi, handoffSql] = await Promise.all([
    readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/access.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/accessContract.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/stripeApi.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/stripe-report-access-handoff.sql", import.meta.url), "utf8")
  ]);
  assert.match(reportPage, /verifyReportCheckoutHandoff\(scan\.id, searchParams\.session_id\)/);
  assert.match(reportPage, /redirect\(reportAccessHref\(`\/reports\/\$\{scan\.id\}`/);
  assert.match(reportPage, /if \(checkoutHandoffFulfilled\)[\s\S]*redirect/);
  assert.doesNotMatch(reportPage, /access=\$\{[^}]*session_id/);
  assert.match(paymentAccess, /isMatchingPaidReportSession\(session, scanId, config\.prices\.report\)/);
  assert.match(paymentAccess, /await dependencies\.fulfillCheckout\(scanId, session\)/);
  assert.match(accessContract, /session\.metadata\?\.scan_id === scanId/);
  assert.doesNotMatch(accessContract, /amount_total === 4900/);
  assert.match(accessContract, /latestCharge\.refunded === false/);
  assert.match(stripeApi, /query\.append\("expand\[\]", expansion\)/);
  assert.match(stripeApi, /"payment_intent\.latest_charge"/);
  assert.match(persistence, /p_customer_email: customerEmail/);
  assert.match(persistence, /SUPABASE_SERVICE_ROLE_KEY|databaseHeaders/);
  assert.match(persistence, /rpc\/fulfill_verified_report_checkout/);
  assert.match(handoffSql, /on conflict \(stripe_checkout_session_id\) do nothing/);
  assert.match(handoffSql, /p_customer_email text/);
  assert.match(handoffSql, /drop function if exists fulfill_verified_report_checkout\(uuid, text, text, text, timestamptz, boolean\)/);
  assert.match(handoffSql, /and status = 'active'/);
  assert.match(handoffSql, /security definer/);
  assert.match(handoffSql, /grant execute[\s\S]*to service_role/);
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`\nPayment access verification passed: ${passed}/${tests.length} checks.`);
