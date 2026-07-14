import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifiedPaidSubscriptionCheckout } from "../lib/payments/accessContract.ts";

const prices = {
  monitorMonthly: "price_monitor_monthly",
  monitorAnnual: "price_monitor_annual",
  growthMonthly: "price_growth_monthly",
  growthAnnual: "price_growth_annual"
};

function session(overrides = {}) {
  return {
    id: "cs_test_subscription123",
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
      price_id: prices.monitorMonthly
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

const [onboarding, handoff, persistence, sql] = await Promise.all([
  readFile(new URL("../app/dashboard/onboarding/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/subscriptionHandoff.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/persistence.ts", import.meta.url), "utf8"),
  readFile(new URL("../db/stripe-report-access-handoff.sql", import.meta.url), "utf8")
]);

assert.match(onboarding, /verifySubscriptionCheckoutHandoff/);
assert.match(onboarding, /handoff === "fulfilled"/);
assert.match(onboarding, /payment is complete\. We are activating monitoring/i);
assert.match(handoff, /verifiedPaidSubscriptionCheckout/);
assert.match(persistence, /rpc\/fulfill_verified_subscription_checkout/);
assert.match(sql, /auth_user_id = p_auth_user_id/);
assert.match(sql, /stripe_customer_id is null or stripe_customer_id = p_customer_id/);
assert.match(sql, /status in \('active', 'trialing'\)/);
assert.match(sql, /grant execute on function fulfill_verified_subscription_checkout[\s\S]*to service_role/);

console.log("Subscription checkout handoff checks passed.");
