import assert from "node:assert/strict";

import { handleCheckout } from "../lib/payments/handlers.ts";
import {
  clearReportCatalogPreflightCache,
  validateReportCatalogPrice,
  verifyReportCatalog,
  verifyReportCatalogCached
} from "../lib/payments/reportCatalogPreflight.ts";

const CHECKED_AT = new Date("2026-07-14T12:00:00.000Z");
const PRICE_ID = "price_report_fixture";

function reportPrice(overrides = {}) {
  const product = {
    id: "prod_report_fixture",
    active: true,
    livemode: true
  };
  return {
    id: PRICE_ID,
    active: true,
    currency: "usd",
    livemode: true,
    product,
    recurring: null,
    type: "one_time",
    unit_amount: 4_900,
    ...overrides
  };
}

function validate(price, overrides = {}) {
  return validateReportCatalogPrice(price, {
    configuredPriceId: PRICE_ID,
    requireLivemode: true,
    checkedAt: CHECKED_AT,
    ...overrides
  });
}

assert.deepEqual(validate(reportPrice()), {
  ok: true,
  code: "VERIFIED",
  reason: "Configured Report price verified.",
  checkedAt: CHECKED_AT.toISOString()
});

const invalidFixtures = [
  ["configured Price ID mapping", reportPrice({ id: "price_wrong_fixture" }), "PRICE_ID_MISMATCH"],
  ["active price", reportPrice({ active: false }), "PRICE_INACTIVE"],
  ["USD $49 amount", reportPrice({ unit_amount: 5_000 }), "AMOUNT_MISMATCH"],
  ["USD currency", reportPrice({ currency: "eur" }), "CURRENCY_MISMATCH"],
  [
    "one-time type",
    reportPrice({ type: "recurring", recurring: { interval: "month" } }),
    "BILLING_TYPE_MISMATCH"
  ],
  [
    "one-time interval semantics",
    reportPrice({ recurring: { interval: "month" } }),
    "BILLING_TYPE_MISMATCH"
  ],
  ["expanded product mapping", reportPrice({ product: "prod_unexpanded" }), "PRODUCT_INVALID"],
  [
    "active product",
    reportPrice({ product: { id: "prod_report_fixture", active: false, livemode: true } }),
    "PRODUCT_INACTIVE"
  ],
  ["live price mode", reportPrice({ livemode: false }), "MODE_MISMATCH"],
  [
    "live product mode",
    reportPrice({ product: { id: "prod_report_fixture", active: true, livemode: false } }),
    "MODE_MISMATCH"
  ]
];

for (const [label, fixture, expectedCode] of invalidFixtures) {
  const result = validate(fixture);
  assert.equal(result.ok, false, `${label} fixture must fail closed`);
  assert.equal(result.code, expectedCode, `${label} fixture returned the wrong reason`);
  assert.ok(result.reason.length > 10);
  assert.doesNotMatch(result.reason, /sk_(?:test|live)_|price_report_fixture|prod_report_fixture/);
}

assert.equal(
  validate(
    reportPrice({
      livemode: false,
      product: { id: "prod_report_fixture", active: true, livemode: false }
    }),
    { requireLivemode: false }
  ).ok,
  true,
  "non-production verification may use test-mode catalog fixtures"
);

const baseConfig = {
  secretKey: "sk_test_fixture_not_used",
  prices: {
    report: PRICE_ID,
    monitorMonthly: "",
    monitorAnnual: "",
    growthMonthly: "",
    growthAnnual: "",
    requireLivemode: true
  }
};

const unavailable = await verifyReportCatalog(baseConfig, {
  retrievePrice: async () => {
    throw new Error("fixture network failure with sk_live_do_not_expose");
  },
  now: () => CHECKED_AT.getTime()
});
assert.equal(unavailable.ok, false);
assert.equal(unavailable.code, "STRIPE_UNAVAILABLE");
assert.doesNotMatch(unavailable.reason, /sk_live_do_not_expose|price_report_fixture/);

clearReportCatalogPreflightCache();
let retrievals = 0;
let now = CHECKED_AT.getTime();
const cachedDependencies = {
  retrievePrice: async () => {
    retrievals += 1;
    return reportPrice();
  },
  now: () => now
};
assert.equal((await verifyReportCatalogCached(baseConfig, cachedDependencies)).ok, true);
assert.equal((await verifyReportCatalogCached(baseConfig, cachedDependencies)).ok, true);
assert.equal(retrievals, 1, "successful catalog verification must be server-side cached");
now += 5 * 60_000 + 1;
assert.equal((await verifyReportCatalogCached(baseConfig, cachedDependencies)).ok, true);
assert.equal(retrievals, 2, "catalog verification must refresh after its cache window");

let checkoutSessions = 0;
const originalConsoleError = console.error;
console.error = () => {};
try {
  const response = await handleCheckout(
    new Request("https://scanner.example.test/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "report",
        customerEmail: "buyer@example.com",
        requestId: "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9",
        scanId: "91a3e66c-2c07-46cf-ab0c-3768375e050a"
      })
    }),
    null,
    {
      getConfig: () => ({
        ...baseConfig,
        webhookSecret: "whsec_fixture",
        appUrl: "https://scanner.example.test",
        subscriptionCheckoutEnabled: false
      }),
      scanExists: async () => true,
      verifyReportCatalog: async () => ({
        ok: false,
        code: "AMOUNT_MISMATCH",
        reason: "The configured Report price must be USD $49.00.",
        checkedAt: CHECKED_AT.toISOString()
      }),
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
      code: "REPORT_CATALOG_INVALID",
      message: "The configured Report price must be USD $49.00."
    }
  });
} finally {
  console.error = originalConsoleError;
}
assert.equal(checkoutSessions, 0, "invalid catalog preflight must not create a Checkout Session");

console.log("Stripe Report catalog preflight passed fixture-only verification.");
