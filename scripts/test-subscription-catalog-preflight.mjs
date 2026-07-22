import assert from "node:assert/strict";

import {
  applySubscriptionCatalogHealth,
  clearSubscriptionCatalogPreflightCache,
  validateSubscriptionCatalogPrice,
  verifySubscriptionCatalog,
  verifySubscriptionCatalogCached
} from "../lib/payments/subscriptionCatalogPreflight.ts";
import { handleCheckout } from "../lib/payments/handlers.ts";

const CHECKED_AT = new Date("2026-07-22T12:00:00.000Z");
const EXPECTATIONS = {
  monitorMonthly: { unitAmount: 9_900, interval: "month" },
  monitorAnnual: { unitAmount: 99_000, interval: "year" },
  growthMonthly: { unitAmount: 24_900, interval: "month" },
  growthAnnual: { unitAmount: 249_000, interval: "year" }
};
const PRICE_IDS = Object.fromEntries(
  Object.keys(EXPECTATIONS).map((key) => [key, `price_${key}_fixture`])
);

function subscriptionPrice(key, overrides = {}) {
  return {
    id: PRICE_IDS[key],
    active: true,
    currency: "usd",
    livemode: true,
    product: {
      id: `prod_${key}_fixture`,
      active: true,
      livemode: true
    },
    recurring: { interval: EXPECTATIONS[key].interval, interval_count: 1 },
    type: "recurring",
    unit_amount: EXPECTATIONS[key].unitAmount,
    ...overrides
  };
}

function validate(key, price, overrides = {}) {
  return validateSubscriptionCatalogPrice(price, {
    key,
    configuredPriceId: PRICE_IDS[key],
    requireLivemode: true,
    checkedAt: CHECKED_AT,
    ...EXPECTATIONS[key],
    ...overrides
  });
}

for (const key of Object.keys(EXPECTATIONS)) {
  assert.deepEqual(validate(key, subscriptionPrice(key)), {
    ok: true,
    code: "VERIFIED",
    reason: "Configured subscription prices verified.",
    checkedAt: CHECKED_AT.toISOString()
  });
}

const invalidFixtures = [
  ["mapping", "monitorMonthly", subscriptionPrice("monitorMonthly", { id: "price_wrong_fixture" }), "PRICE_ID_MISMATCH"],
  ["active price", "monitorMonthly", subscriptionPrice("monitorMonthly", { active: false }), "PRICE_INACTIVE"],
  ["amount", "monitorMonthly", subscriptionPrice("monitorMonthly", { unit_amount: 10_000 }), "AMOUNT_MISMATCH"],
  ["currency", "monitorMonthly", subscriptionPrice("monitorMonthly", { currency: "eur" }), "CURRENCY_MISMATCH"],
  ["recurring type", "monitorMonthly", subscriptionPrice("monitorMonthly", { type: "one_time", recurring: null }), "BILLING_TYPE_MISMATCH"],
  ["monthly interval", "monitorMonthly", subscriptionPrice("monitorMonthly", { recurring: { interval: "year" } }), "INTERVAL_MISMATCH"],
  ["annual interval", "monitorAnnual", subscriptionPrice("monitorAnnual", { recurring: { interval: "month" } }), "INTERVAL_MISMATCH"],
  ["interval count", "monitorMonthly", subscriptionPrice("monitorMonthly", { recurring: { interval: "month", interval_count: 2 } }), "INTERVAL_MISMATCH"],
  ["expanded product", "monitorMonthly", subscriptionPrice("monitorMonthly", { product: "prod_unexpanded" }), "PRODUCT_INVALID"],
  ["active product", "monitorMonthly", subscriptionPrice("monitorMonthly", { product: { id: "prod_fixture", active: false, livemode: true } }), "PRODUCT_INACTIVE"],
  ["live price", "monitorMonthly", subscriptionPrice("monitorMonthly", { livemode: false }), "MODE_MISMATCH"],
  ["live product", "monitorMonthly", subscriptionPrice("monitorMonthly", { product: { id: "prod_fixture", active: true, livemode: false } }), "MODE_MISMATCH"]
];

for (const [label, key, fixture, expectedCode] of invalidFixtures) {
  const result = validate(key, fixture);
  assert.equal(result.ok, false, `${label} fixture must fail closed`);
  assert.equal(result.code, expectedCode, `${label} fixture returned the wrong code`);
  assert.doesNotMatch(result.reason, /sk_(?:test|live)_|price_|prod_/);
}

assert.equal(
  validate("monitorMonthly", subscriptionPrice("monitorMonthly", {
    livemode: false,
    product: { id: "prod_fixture", active: true, livemode: false }
  }), { requireLivemode: false }).ok,
  true,
  "non-production verification may use test-mode prices"
);

const baseConfig = {
  secretKey: "sk_test_fixture_not_used",
  prices: {
    report: "price_report_fixture",
    ...PRICE_IDS,
    requireLivemode: true
  }
};

const validDependencies = {
  retrievePrice: async (_secretKey, priceId) => {
    const key = Object.keys(PRICE_IDS).find((candidate) => PRICE_IDS[candidate] === priceId);
    assert.ok(key, "only configured fixture prices may be retrieved");
    return subscriptionPrice(key);
  },
  now: () => CHECKED_AT.getTime()
};

assert.deepEqual(await verifySubscriptionCatalog(baseConfig, validDependencies), {
  ok: true,
  code: "VERIFIED",
  reason: "Configured subscription prices verified.",
  checkedAt: CHECKED_AT.toISOString()
});

const missing = await verifySubscriptionCatalog({
  ...baseConfig,
  prices: { ...baseConfig.prices, growthAnnual: "" }
}, validDependencies);
assert.equal(missing.ok, false);
assert.equal(missing.code, "CONFIGURATION_MISSING");

const duplicate = await verifySubscriptionCatalog({
  ...baseConfig,
  prices: { ...baseConfig.prices, growthAnnual: PRICE_IDS.growthMonthly }
}, validDependencies);
assert.equal(duplicate.ok, false);
assert.equal(duplicate.code, "DUPLICATE_PRICE_ID");

const unavailable = await verifySubscriptionCatalog(baseConfig, {
  retrievePrice: async () => {
    throw new Error("fixture failure with sk_live_secret and price_private");
  },
  now: () => CHECKED_AT.getTime()
});
assert.equal(unavailable.ok, false);
assert.equal(unavailable.code, "STRIPE_UNAVAILABLE");
assert.doesNotMatch(unavailable.reason, /sk_live_secret|price_private/);

clearSubscriptionCatalogPreflightCache();
let retrievals = 0;
let now = CHECKED_AT.getTime();
const cachedDependencies = {
  ...validDependencies,
  retrievePrice: async (...args) => {
    retrievals += 1;
    return validDependencies.retrievePrice(...args);
  },
  now: () => now
};
assert.equal((await verifySubscriptionCatalogCached(baseConfig, cachedDependencies)).ok, true);
assert.equal((await verifySubscriptionCatalogCached(baseConfig, cachedDependencies)).ok, true);
assert.equal(retrievals, 4, "one successful verification must retrieve each price once");
now += 5 * 60_000 + 1;
assert.equal((await verifySubscriptionCatalogCached(baseConfig, cachedDependencies)).ok, true);
assert.equal(retrievals, 8, "catalog verification must refresh after its cache window");

const reportReadyHealth = {
  ok: true,
  ready: { demo: true, paidSignup: true, reportCheckout: true, subscriptionCheckout: true },
  services: { reportCatalog: "verified", subscriptions: true }
};
const invalidHealth = applySubscriptionCatalogHealth(reportReadyHealth, unavailable);
assert.equal(invalidHealth.ready.reportCheckout, true, "subscription failure must not close Report checkout");
assert.equal(invalidHealth.ready.subscriptionCheckout, false, "subscription readiness must fail closed");
assert.equal(invalidHealth.services.subscriptions, false);
assert.equal(invalidHealth.services.subscriptionCatalog, "invalid");
assert.doesNotMatch(JSON.stringify(invalidHealth), /sk_live_secret|price_private|price_monitor/);

const verifiedHealth = applySubscriptionCatalogHealth(reportReadyHealth, {
  ok: true,
  code: "VERIFIED",
  reason: "Configured subscription prices verified.",
  checkedAt: CHECKED_AT.toISOString()
});
assert.equal(verifiedHealth.ready.subscriptionCheckout, true);
assert.equal(verifiedHealth.services.subscriptionCatalog, "verified");

const unverifiedHealth = applySubscriptionCatalogHealth(reportReadyHealth);
assert.equal(unverifiedHealth.ready.reportCheckout, true);
assert.equal(unverifiedHealth.ready.subscriptionCheckout, false);
assert.equal(unverifiedHealth.services.subscriptionCatalog, "unverified");

let checkoutSessions = 0;
const originalConsoleError = console.error;
console.error = () => {};
try {
  const response = await handleCheckout(
    new Request("https://scanner.example.test/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "monitor",
        billingInterval: "monthly",
        customerEmail: "buyer@example.com",
        requestId: "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9",
        scanId: "91a3e66c-2c07-46cf-ab0c-3768375e050a"
      })
    }),
    {
      verifiedEmail: "buyer@example.com",
      ownedCustomerId: "cus_fixture",
      accountId: "1c65ed91-a079-46b3-9446-d607e91875ad"
    },
    {
      getConfig: () => ({
        ...baseConfig,
        webhookSecret: "whsec_fixture",
        appUrl: "https://scanner.example.test",
        subscriptionCheckoutEnabled: true
      }),
      inspectReport: async () => ({ ok: true }),
      inspectSubscriptionSource: async () => ({ ok: true }),
      verifyReportCatalog: async () => ({
        ok: true,
        code: "VERIFIED",
        reason: "Configured Report price verified.",
        checkedAt: CHECKED_AT.toISOString()
      }),
      verifySubscriptionCatalog: async () => unavailable,
      createSession: async () => {
        checkoutSessions += 1;
        return { id: "cs_should_not_exist", url: "https://checkout.stripe.com/c/pay/should-not-open" };
      }
    }
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: "SUBSCRIPTION_CATALOG_INVALID",
      message: "Stripe could not verify the configured subscription prices."
    }
  });
} finally {
  console.error = originalConsoleError;
}
assert.equal(checkoutSessions, 0, "invalid subscription catalog must not create a Checkout Session");

console.log("Stripe subscription catalog preflight passed fixture-only verification.");
