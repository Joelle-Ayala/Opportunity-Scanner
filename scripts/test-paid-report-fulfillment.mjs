import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  deliverPaidReportFulfillment,
  paidReportClaimUrl,
  paidReportFulfillmentFromStripeEvent,
  sendPaidReportEmail
} from "../lib/transactionalEmail/paidReport.ts";

const SCAN_ID = "91a3e66c-2c07-46cf-ab0c-3768375e050a";
const SESSION_ID = "cs_live_paidreportfixture";
const stripeConfig = {
  secretKey: "sk_live_fixture",
  webhookSecret: "whsec_fixture",
  appUrl: "https://scanner.example.test",
  subscriptionCheckoutEnabled: false,
  prices: {
    report: "price_report_fixture",
    monitorMonthly: "",
    monitorAnnual: "",
    growthMonthly: "",
    growthAnnual: "",
    requireLivemode: true
  }
};
const emailConfig = {
  apiKey: "re_fixture",
  fromEmail: "reports@example.test",
  appUrl: "https://scanner.example.test",
  supportEmail: "support@example.test"
};

function paidEvent(overrides = {}) {
  return {
    id: "evt_paid_report_fixture",
    type: "checkout.session.completed",
    livemode: true,
    data: {
      object: {
        id: SESSION_ID,
        mode: "payment",
        payment_status: "paid",
        customer_details: { email: " Buyer@Example.Test " },
        metadata: {
          product: "report",
          price_id: stripeConfig.prices.report,
          scan_id: SCAN_ID
        },
        ...overrides
      }
    }
  };
}

assert.deepEqual(paidReportFulfillmentFromStripeEvent(paidEvent(), stripeConfig), {
  scanId: SCAN_ID,
  checkoutSessionId: SESSION_ID,
  recipientEmail: "buyer@example.test"
});

for (const event of [
  { ...paidEvent(), type: "charge.refunded" },
  { ...paidEvent(), type: "charge.dispute.created" },
  paidEvent({ mode: "subscription" }),
  paidEvent({ payment_status: "unpaid" }),
  paidEvent({ metadata: { product: "report", price_id: "price_wrong", scan_id: SCAN_ID } }),
  { ...paidEvent(), livemode: false }
]) {
  assert.equal(paidReportFulfillmentFromStripeEvent(event, stripeConfig), null);
}

const claimUrl = paidReportClaimUrl(emailConfig, SCAN_ID);
assert.equal(
  claimUrl,
  `https://scanner.example.test/auth/sign-in?next=%2Freports%2F${SCAN_ID}%3Fclaim%3Dpaid`
);
assert.doesNotMatch(claimUrl, /cs_|pi_|evt_|token=|access=/);

let resendRequest;
const providerId = await sendPaidReportEmail(
  emailConfig,
  {
    scanId: SCAN_ID,
    recipientEmail: "buyer@example.test",
    deliveryId: "1f3e72ce-4d15-4a36-8e9c-37ae019c8e90"
  },
  async (url, init) => {
    resendRequest = { url, init, body: JSON.parse(String(init.body)) };
    return Response.json({ id: "resend-message-fixture" });
  }
);
assert.equal(providerId, "resend-message-fixture");
assert.equal(resendRequest.url, "https://api.resend.com/emails");
assert.equal(
  resendRequest.init.headers["Idempotency-Key"],
  "paid-report/1f3e72ce-4d15-4a36-8e9c-37ae019c8e90/claim"
);
assert.deepEqual(resendRequest.body.to, ["buyer@example.test"]);
assert.match(resendRequest.body.text, /Sign in with the email used for your purchase/);
assert.doesNotMatch(JSON.stringify(resendRequest.body), /cs_|pi_|evt_|sk_live|whsec|access code/i);
await assert.rejects(
  sendPaidReportEmail(emailConfig, {
    scanId: SCAN_ID,
    recipientEmail: "buyer@example.test",
    deliveryId: "not-a-delivery"
  }),
  /delivery ID is invalid/
);

const recorded = [];
let sends = 0;
const success = await deliverPaidReportFulfillment(paidEvent(), stripeConfig, {
  prepare: async () => ({
    delivery_id: "1f3e72ce-4d15-4a36-8e9c-37ae019c8e90",
    recipient_email: "buyer@example.test",
    attempt_number: 1
  }),
  record: async (input) => {
    recorded.push(input);
    return true;
  },
  send: async () => {
    sends += 1;
    return "provider-message";
  },
  emailConfig: () => emailConfig
});
assert.deepEqual(success, {
  status: "delivered",
  deliveryId: "1f3e72ce-4d15-4a36-8e9c-37ae019c8e90"
});
assert.equal(sends, 1);
assert.equal(recorded.at(-1).status, "delivered");

const providerFailureRecords = [];
const providerFailure = await deliverPaidReportFulfillment(paidEvent(), stripeConfig, {
  prepare: async () => ({
    delivery_id: "bb33c950-5b66-42ce-adf4-b1a535598a74",
    recipient_email: "buyer@example.test",
    attempt_number: 2
  }),
  record: async (input) => {
    providerFailureRecords.push(input);
    return true;
  },
  send: async () => {
    throw new Error("provider unavailable with buyer@example.test");
  },
  emailConfig: () => emailConfig
});
assert.deepEqual(providerFailure, { status: "failed", failureCode: "provider_failure" });
assert.equal(providerFailureRecords.at(-1).failureCode, "provider_failure");
assert.equal((await deliverPaidReportFulfillment(paidEvent(), stripeConfig, {
  prepare: async () => null,
  record: async () => true,
  send: async () => "unused",
  emailConfig: () => emailConfig
})).status, "skipped");

const [migration, handler, persistence, reportPage] = await Promise.all([
  readFile(new URL("../db/paid-report-fulfillment-recovery.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/handlers.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8")
]);

assert.match(migration, /create table if not exists public\.paid_report_delivery_attempts/);
assert.match(migration, /report_access_grant_id uuid not null unique/);
assert.match(migration, /report_grant\.status = 'active'/);
assert.match(migration, /lower\(stripe_customer\.email\) = v_account_email/);
assert.match(migration, /customer_account_id <> p_customer_account_id/);
assert.match(migration, /access_level[\s\S]*?'free'/);
assert.match(migration, /enable row level security/);
assert.match(handler, /REPORT_DELIVERY_RETRY_REQUIRED/);
assert.match(handler, /deliverPaidReportFulfillment/);
assert.match(persistence, /claim_active_report_purchase_by_email/);
assert.match(reportPage, /searchParams\?\.claim === "paid"/);
assert.match(reportPage, /claimActiveReportPurchaseByEmail/);
assert.match(reportPage, /Purchase complete - your full report is unlocked/);
assert.match(reportPage, /href="#full-pipeline"/);
assert.match(reportPage, /Sign out and use purchase email/);
assert.match(reportPage, /action="\/api\/auth\/sign-out"/);
assert.match(reportPage, /name="next"/);
assert.match(reportPage, /claim=failed/);
assert.doesNotMatch(reportPage, /claim=paid[^\n]{0,200}session_id/);

console.log("Paid Report fulfillment and close-tab recovery checks passed.");
