import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifiedPaidSubscriptionCheckout } from "../lib/payments/accessContract.ts";
import { inspectSubscriptionSourceReport } from "../lib/payments/handlers.ts";
import { verifySubscriptionCheckoutHandoff } from "../lib/payments/subscriptionHandoff.ts";
import { createCheckoutSession } from "../lib/payments/stripeApi.ts";

const sourceScanId = "91a3e66c-2c07-46cf-ab0c-3768375e050a";

const prices = {
  monitorMonthly: "price_monitor_monthly",
  monitorAnnual: "price_monitor_annual",
  growthMonthly: "price_growth_monthly",
  growthAnnual: "price_growth_annual"
};

function session(overrides = {}) {
  return {
    id: "cs_test_subscription123",
    client_reference_id: sourceScanId,
    created: 1_750_000_000,
    livemode: true,
    status: "complete",
    mode: "subscription",
    payment_status: "paid",
    customer: "cus_customer123",
    customer_details: { email: "buyer@example.com" },
    metadata: {
      product: "monitor",
      billing_interval: "monthly",
      price_id: prices.monitorMonthly,
      scan_id: sourceScanId
    },
    line_items: {
      has_more: false,
      data: [{ quantity: 1, price: { id: prices.monitorMonthly } }]
    },
    subscription: {
      id: "sub_subscription123",
      customer: "cus_customer123",
      status: "active",
      cancel_at_period_end: false,
      metadata: { scan_id: sourceScanId },
      items: {
        data: [{
          price: { id: prices.monitorMonthly },
          current_period_start: 1_750_000_000,
          current_period_end: 1_752_592_000
        }]
      }
    },
    ...overrides
  };
}

const verified = verifiedPaidSubscriptionCheckout(session(), "BUYER@EXAMPLE.COM", prices);
assert.equal(verified?.customerId, "cus_customer123");
assert.equal(verified?.subscriptionId, "sub_subscription123");
assert.equal(verified?.product, "monitor");
assert.equal(verified?.billingInterval, "monthly");

let registeredActivation = null;
const handoffDependencies = {
  getConfig: () => ({ secretKey: "sk_test_handoff", prices }),
  retrieveSession: async () => session(),
  fulfillCheckout: async () => true,
  registerActivation: async (activation) => {
    registeredActivation = activation;
    return true;
  }
};
assert.deepEqual(
  await verifySubscriptionCheckoutHandoff({
    authUserId: "cfda4281-4662-4eba-b304-88ea42125cec",
    customerAccountId: "1c65ed91-a079-46b3-9446-d607e91875ad",
    verifiedEmail: "buyer@example.com",
    sessionId: "cs_test_subscription123"
  }, handoffDependencies),
  { status: "fulfilled", sourceScanId },
  "a verified subscription return preserves its server-recorded report"
);
assert.deepEqual(registeredActivation, {
  customerId: "cus_customer123",
  customerEmail: "buyer@example.com",
  subscriptionId: "sub_subscription123",
  sourceScanId
});

let mismatchFulfillments = 0;
assert.deepEqual(
  await verifySubscriptionCheckoutHandoff({
    authUserId: "cfda4281-4662-4eba-b304-88ea42125cec",
    customerAccountId: "1c65ed91-a079-46b3-9446-d607e91875ad",
    verifiedEmail: "buyer@example.com",
    sessionId: "cs_test_subscription123"
  }, {
    ...handoffDependencies,
    retrieveSession: async () => session({ client_reference_id: "a4b2b8bb-7538-49ab-926b-d72f393932bd" }),
    fulfillCheckout: async () => {
      mismatchFulfillments += 1;
      return true;
    }
  }),
  { status: "invalid", sourceScanId: null },
  "mismatched Stripe source metadata fails closed"
);
assert.equal(mismatchFulfillments, 0);

assert.deepEqual(
  await verifySubscriptionCheckoutHandoff({
    authUserId: "cfda4281-4662-4eba-b304-88ea42125cec",
    customerAccountId: "1c65ed91-a079-46b3-9446-d607e91875ad",
    verifiedEmail: "buyer@example.com",
    sessionId: "cs_test_subscription123"
  }, {
    ...handoffDependencies,
    registerActivation: async () => false
  }),
  { status: "unavailable", sourceScanId: null },
  "a fulfilled payment stays in recovery when activation registration is unavailable"
);

const originalFetch = globalThis.fetch;
let checkoutForm;
try {
  globalThis.fetch = async (_input, init) => {
    checkoutForm = new URLSearchParams(String(init?.body ?? ""));
    return Response.json({ id: "cs_test_subscription123", url: "https://checkout.stripe.com/c/pay/test" });
  };
  await createCheckoutSession({
    secretKey: "sk_test_handoff",
    priceId: prices.monitorMonthly,
    mode: "subscription",
    plan: "monitor",
    interval: "monthly",
    email: "buyer@example.com",
    customerId: "cus_customer123",
    scanId: sourceScanId,
    requestId: "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9",
    successUrl: "https://scanner.example.test/dashboard/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://scanner.example.test/pricing?checkout=cancelled"
  });
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(checkoutForm.get("client_reference_id"), sourceScanId);
assert.equal(checkoutForm.get("metadata[scan_id]"), sourceScanId);
assert.equal(checkoutForm.get("subscription_data[metadata][scan_id]"), sourceScanId);

Object.assign(process.env, {
  SUPABASE_URL: "https://database.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-handoff"
});
try {
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/customer_scan_ownership")) {
      return Response.json(url.searchParams.get("customer_account_id") === "eq.1c65ed91-a079-46b3-9446-d607e91875ad"
        ? [{ scan_id: sourceScanId }]
        : []);
    }
    if (url.pathname.endsWith("/scans")) return Response.json([{ id: sourceScanId, status: "completed" }]);
    return new Response(null, { status: 404 });
  };
  assert.deepEqual(
    await inspectSubscriptionSourceReport(sourceScanId, "1c65ed91-a079-46b3-9446-d607e91875ad"),
    { ok: true }
  );
  assert.equal(
    (await inspectSubscriptionSourceReport(sourceScanId, "d869b4ab-6911-4fc7-a6b6-d726a395df60")).code,
    "REPORT_OWNERSHIP_CONFLICT"
  );
  assert.equal((await inspectSubscriptionSourceReport(sourceScanId, null)).code, "AUTHENTICATION_REQUIRED");
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal(
  verifiedPaidSubscriptionCheckout(session({ customer_details: { email: "attacker@example.com" } }), "buyer@example.com", prices),
  null,
  "a checkout cannot activate a different signed-in email"
);
assert.equal(
  verifiedPaidSubscriptionCheckout(session({ subscription: { ...session().subscription, customer: "cus_other" } }), "buyer@example.com", prices),
  null,
  "the expanded subscription must belong to the checkout customer"
);
assert.equal(
  verifiedPaidSubscriptionCheckout(session({ line_items: { data: [{ quantity: 1, price: { id: prices.growthMonthly } }] } }), "buyer@example.com", prices),
  null,
  "the checkout and subscription Prices must match exactly"
);

const [onboarding, handoff, persistence, sql, pricingCheckout, reportCheckout] = await Promise.all([
  readFile(new URL("../app/dashboard/onboarding/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/subscriptionHandoff.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8"),
  readFile(new URL("../db/stripe-report-access-handoff.sql", import.meta.url), "utf8"),
  readFile(new URL("../components/checkout-button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/report-monitor-checkout.tsx", import.meta.url), "utf8")
]);

assert.match(onboarding, /verifySubscriptionCheckoutHandoff/);
assert.match(onboarding, /handoff\?\.status === "fulfilled"/);
assert.match(onboarding, /params\.set\("source_scan_id", handoff\.sourceScanId\)/);
assert.match(onboarding, /eligibleReports\.find\(\(report\) => report\.scanId === requestedSourceScanId\)/);
assert.match(onboarding, /monitoredProfile\.status !== "canceled"/);
assert.doesNotMatch(onboarding, /Pause or archive a saved search/);
assert.match(onboarding, /payment is complete\. We are activating monitoring/i);
assert.match(handoff, /verifiedPaidSubscriptionCheckout/);
assert.match(handoff, /session\.client_reference_id/);
assert.match(handoff, /subscription\?\.metadata\?\.scan_id/);
assert.match(persistence, /rpc\/fulfill_verified_subscription_checkout/);
assert.match(sql, /auth_user_id = p_auth_user_id/);
assert.match(sql, /stripe_customer_id is null or stripe_customer_id = p_customer_id/);
assert.match(sql, /status in \('active', 'trialing'\)/);
assert.match(sql, /grant execute on function fulfill_verified_subscription_checkout[\s\S]*to service_role/);
for (const checkout of [pricingCheckout, reportCheckout]) {
  assert.match(checkout, /secureStripeBillingPortalUrl/);
  assert.match(checkout, /\(!checkoutUrl && !portalUrl\)/);
  assert.match(checkout, /checkoutUrl \|\| portalUrl!/);
}
assert.match(reportCheckout, /scanId/);

console.log("Subscription checkout handoff checks passed.");
