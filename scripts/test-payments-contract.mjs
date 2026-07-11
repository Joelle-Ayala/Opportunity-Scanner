import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getStripeServerConfig, priceFor } from "../lib/payments/config.ts";
import { validateCheckoutInput, validatePortalInput } from "../lib/payments/contract.ts";
import { verifyStripeSignature } from "../lib/payments/signature.ts";

const ENV_NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  "STRIPE_PRICE_REPORT",
  "STRIPE_PRICE_MONITOR_MONTHLY",
  "STRIPE_PRICE_MONITOR_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL"
];
const originalEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));

function installTestEnv() {
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_contract",
    STRIPE_WEBHOOK_SECRET: "whsec_contract",
    APP_URL: "https://scanner.example.test",
    STRIPE_PRICE_REPORT: "price_report_server",
    STRIPE_PRICE_MONITOR_MONTHLY: "price_monitor_monthly_server",
    STRIPE_PRICE_MONITOR_ANNUAL: "price_monitor_annual_server",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_monthly_server",
    STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_annual_server"
  });
}

function checkout(overrides = {}) {
  return {
    plan: "report",
    customerEmail: "BUYER@EXAMPLE.COM",
    requestId: "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9",
    scanId: "91a3e66c-2c07-46cf-ab0c-3768375e050a",
    ...overrides
  };
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("maps every product and interval to server-only Price IDs", () => {
  installTestEnv();
  const config = getStripeServerConfig();
  assert.equal(priceFor(config, "report", null), "price_report_server");
  assert.equal(priceFor(config, "monitor", "monthly"), "price_monitor_monthly_server");
  assert.equal(priceFor(config, "monitor", "annual"), "price_monitor_annual_server");
  assert.equal(priceFor(config, "growth", "monthly"), "price_growth_monthly_server");
  assert.equal(priceFor(config, "growth", "annual"), "price_growth_annual_server");
});

test("fails closed when any required Stripe setting is absent or malformed", () => {
  installTestEnv();
  delete process.env.STRIPE_PRICE_GROWTH_ANNUAL;
  assert.throws(() => getStripeServerConfig(), /STRIPE_PRICE_GROWTH_ANNUAL/);
  installTestEnv();
  process.env.APP_URL = "https://user:password@scanner.example.test";
  assert.throws(() => getStripeServerConfig(), /APP_URL/);
  installTestEnv();
  process.env.STRIPE_PRICE_REPORT = "prod_report";
  assert.throws(() => getStripeServerConfig(), /STRIPE_PRICE_REPORT/);
});

test("accepts the one-time Report contract and normalizes identity fields", () => {
  const result = validateCheckoutInput(checkout());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.plan, "report");
    assert.equal(result.value.billingInterval, null);
    assert.equal(result.value.customerEmail, "buyer@example.com");
    assert.equal(result.value.scanId, "91a3e66c-2c07-46cf-ab0c-3768375e050a");
  }
});

test("accepts only monthly or annual server-catalog subscriptions", () => {
  for (const plan of ["monitor", "growth"]) {
    for (const billingInterval of ["monthly", "annual"]) {
      const result = validateCheckoutInput(checkout({ plan, billingInterval, scanId: undefined }));
      assert.equal(result.ok, true);
    }
  }
  assert.equal(validateCheckoutInput(checkout({ plan: "enterprise" })).ok, false);
  assert.equal(validateCheckoutInput(checkout({ plan: "monitor", billingInterval: "weekly", scanId: undefined })).ok, false);
});

test("rejects client-controlled prices, destinations, customer IDs, and metadata", () => {
  for (const field of ["priceId", "successUrl", "cancelUrl", "customerId", "metadata"]) {
    const result = validateCheckoutInput(checkout({ [field]: "attacker-controlled" }));
    assert.equal(result.ok, false, `${field} must be rejected`);
    if (!result.ok) assert.equal(result.code, "UNSUPPORTED_FIELD");
  }
});

test("requires a scan only for Report and a request UUID for Stripe idempotency", () => {
  assert.equal(validateCheckoutInput(checkout({ scanId: undefined })).ok, false);
  assert.equal(validateCheckoutInput(checkout({ requestId: "repeat-me" })).ok, false);
  assert.equal(validateCheckoutInput(checkout({ plan: "growth", billingInterval: "monthly" })).ok, false);
});

test("portal accepts only a Checkout Session capability, never a customer ID", () => {
  assert.equal(validatePortalInput({ checkoutSessionId: "cs_test_abc123" }).ok, true);
  assert.equal(validatePortalInput({ customerId: "cus_attacker" }).ok, false);
  assert.equal(validatePortalInput({ checkoutSessionId: "cus_attacker" }).ok, false);
});

test("verifies the raw Stripe payload signature, age, and tamper resistance", () => {
  const payload = JSON.stringify({ id: "evt_contract", type: "checkout.session.completed" });
  const secret = "whsec_contract";
  const timestamp = 1_750_000_000;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const header = `t=${timestamp},v1=invalid,v1=${signature}`;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp), true);
  assert.equal(verifyStripeSignature(`${payload} `, header, secret, timestamp), false);
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp + 301), false);
  assert.equal(verifyStripeSignature(payload, null, secret, timestamp), false);
});

test("routes are Node-only wrappers and the Stripe API contract owns redirects and prices", async () => {
  const [checkoutRoute, portalRoute, webhookRoute, stripeApi, handlers] = await Promise.all([
    readFile(new URL("../app/api/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/billing-portal/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/stripeApi.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payments/handlers.ts", import.meta.url), "utf8")
  ]);
  for (const route of [checkoutRoute, portalRoute, webhookRoute]) {
    assert.match(route, /runtime = "nodejs"/);
    assert.match(route, /export async function POST/);
  }
  assert.match(stripeApi, /"line_items\[0\]\[price\]": input\.priceId/);
  assert.match(stripeApi, /Idempotency-Key/);
  assert.doesNotMatch(stripeApi, /process\.env/);
  assert.match(handlers, /\/reports\/\$\{input\.scanId\}\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(handlers, /\/pricing\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(handlers, /verifyStripeSignature\(payload/);
  assert.match(handlers, /reportScanExists/);
});

test("migration uses an atomic event claim, upserts state, revokes refunds, and exposes RPC only to service role", async () => {
  const sql = await readFile(new URL("../db/stripe-billing-expansion.sql", import.meta.url), "utf8");
  assert.match(sql, /stripe_event_id text primary key/);
  assert.match(sql, /on conflict \(stripe_event_id\) do nothing/);
  assert.match(sql, /on conflict \(stripe_checkout_session_id\) do update/);
  assert.match(sql, /customer\.subscription\.deleted/);
  assert.match(sql, /charge\.refunded/);
  assert.match(sql, /status = 'refunded'/);
  assert.match(sql, /amount_total'\)::bigint = 4900/);
  assert.match(sql, /p_price_catalog->>'report'/);
  assert.match(sql, /stripe_event_created_at <= p_stripe_created_at/);
  assert.match(sql, /security definer/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
  assert.match(sql, /enable row level security/g);
});

let passed = 0;
try {
  for (const { name, run } of tests) {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`\nPayments contract verification passed: ${passed}/${tests.length} checks.`);
} finally {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
