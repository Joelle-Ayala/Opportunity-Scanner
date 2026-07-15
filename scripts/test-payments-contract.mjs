import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getStripeServerConfig, priceFor } from "../lib/payments/config.ts";
import { validateCheckoutInput } from "../lib/payments/contract.ts";
import {
  dispatchCheckoutWithEligibility,
  findActiveCheckoutSubscription,
  inspectedCheckoutPlan
} from "../lib/payments/checkoutEligibility.ts";
import { handleBillingPortal, handleCheckout } from "../lib/payments/handlers.ts";
import { verifyStripeSignature } from "../lib/payments/signature.ts";
import { createCheckoutSession } from "../lib/payments/stripeApi.ts";

const ENV_NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  "STRIPE_PRICE_REPORT",
  "STRIPE_PRICE_MONITOR_MONTHLY",
  "STRIPE_PRICE_MONITOR_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL",
  "ENABLE_SUBSCRIPTION_CHECKOUT",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NODE_ENV"
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
    STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_annual_server",
    ENABLE_SUBSCRIPTION_CHECKOUT: "true"
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

test("allows Report-only configuration while subscription checkout defaults closed", () => {
  installTestEnv();
  process.env.ENABLE_SUBSCRIPTION_CHECKOUT = "false";
  delete process.env.STRIPE_PRICE_MONITOR_MONTHLY;
  delete process.env.STRIPE_PRICE_MONITOR_ANNUAL;
  delete process.env.STRIPE_PRICE_GROWTH_MONTHLY;
  delete process.env.STRIPE_PRICE_GROWTH_ANNUAL;

  const config = getStripeServerConfig();
  assert.equal(config.subscriptionCheckoutEnabled, false);
  assert.equal(priceFor(config, "report", null), "price_report_server");
  assert.throws(() => priceFor(config, "monitor", "monthly"), /Subscription checkout is disabled/);
});

test("requires live Stripe credentials only in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    installTestEnv();
    process.env.NODE_ENV = "test";
    assert.equal(getStripeServerConfig().prices.requireLivemode, false);

    process.env.NODE_ENV = "production";
    assert.throws(() => getStripeServerConfig(), /sk_live_\*/);
    process.env.STRIPE_SECRET_KEY = "sk_live_contract";
    assert.equal(getStripeServerConfig().prices.requireLivemode, true);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("launch environment rejects test credentials without requiring legacy URL codes", () => {
  const launchEnv = {
    ...process.env,
    NODE_ENV: "production",
    OPENAI_API_KEY: "openai-launch-test",
    SUPABASE_URL: "https://database.example.test",
    SUPABASE_ANON_KEY: "anon-launch-test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-launch-test",
    APP_URL: "https://scanner.example.test",
    STRIPE_SECRET_KEY: "sk_test_launch",
    STRIPE_WEBHOOK_SECRET: "whsec_launch",
    STRIPE_PRICE_REPORT: "price_report",
    STRIPE_PRICE_MONITOR_MONTHLY: "price_monitor_monthly",
    STRIPE_PRICE_MONITOR_ANNUAL: "price_monitor_annual",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_monthly",
    STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_annual",
    ENABLE_SUBSCRIPTION_CHECKOUT: "false",
    CRON_SECRET: "cron-launch-test",
    RESEND_API_KEY: "resend-launch-test",
    RESEND_FROM_EMAIL: "scanner@example.test",
    OPPORTUNITY_SCANNER_CONTACT_EMAIL: "support@example.test",
    ALERT_UNSUBSCRIBE_SECRET: "alert-launch-test",
    NURTURE_UNSUBSCRIBE_SECRET: "nurture-launch-test",
    SCAN_RATE_LIMIT_HASH_SECRET: "rate-limit-launch-test",
    NEXT_PUBLIC_POSTHOG_KEY: "posthog-launch-test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://analytics.example.test",
    OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE: "",
    OPPORTUNITY_SCANNER_ADMIN_CODE: "",
    OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION: "false"
  };
  const runLaunchCheck = (secretKey, overrides = {}) => spawnSync(process.execPath, ["scripts/check-launch-env.mjs"], {
    cwd: process.cwd(),
    env: { ...launchEnv, STRIPE_SECRET_KEY: secretKey, ...overrides },
    encoding: "utf8"
  });

  const testMode = runLaunchCheck("sk_test_launch");
  assert.equal(testMode.status, 1);
  assert.match(`${testMode.stdout}${testMode.stderr}`, /must use an sk_live_\* key/);

  const liveMode = runLaunchCheck("sk_live_launch");
  assert.equal(liveMode.status, 0, `${liveMode.stdout}${liveMode.stderr}`);

  const missingSubscriptionPrices = runLaunchCheck("sk_live_launch", {
    ENABLE_SUBSCRIPTION_CHECKOUT: "true",
    STRIPE_PRICE_GROWTH_ANNUAL: ""
  });
  assert.equal(missingSubscriptionPrices.status, 1);
  assert.match(
    `${missingSubscriptionPrices.stdout}${missingSubscriptionPrices.stderr}`,
    /requires all Monitor and Growth Stripe Price IDs/
  );

  const enabledSubscriptions = runLaunchCheck("sk_live_launch", {
    ENABLE_SUBSCRIPTION_CHECKOUT: "true"
  });
  assert.equal(enabledSubscriptions.status, 0, `${enabledSubscriptions.stdout}${enabledSubscriptions.stderr}`);
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

test("checkout handler uses verified account identity and sends anonymous Report buyers through sign-in", async () => {
  installTestEnv();
  const captured = [];
  const dependencies = {
    getConfig: getStripeServerConfig,
    scanExists: async () => true,
    verifyReportCatalog: async () => ({
      ok: true,
      code: "VERIFIED",
      reason: "Configured Report price verified.",
      checkedAt: "2026-07-14T12:00:00.000Z"
    }),
    createSession: async (input) => {
      captured.push(input);
      return { id: `cs_test_${captured.length}`, url: "https://checkout.stripe.com/c/pay/test" };
    }
  };
  const request = () => new Request("https://scanner.example.test/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkout())
  });

  assert.equal((await handleCheckout(request(), null, dependencies)).status, 201);
  assert.equal(captured[0].email, "buyer@example.com");
  assert.equal(captured[0].customerId, null);
  assert.equal(
    captured[0].successUrl,
    "https://scanner.example.test/auth/sign-in?next=%2Freports%2F91a3e66c-2c07-46cf-ab0c-3768375e050a%3Fcheckout%3Dsuccess%26session_id%3D{CHECKOUT_SESSION_ID}"
  );

  assert.equal((await handleCheckout(request(), {
    verifiedEmail: "verified@example.com",
    ownedCustomerId: "cus_ownedBuyer"
  }, dependencies)).status, 201);
  assert.equal(captured[1].email, "verified@example.com");
  assert.equal(captured[1].customerId, "cus_ownedBuyer");
  assert.equal(
    captured[1].successUrl,
    "https://scanner.example.test/reports/91a3e66c-2c07-46cf-ab0c-3768375e050a?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  );
});

test("rejects anonymous subscription checkout before creating a Stripe session", async () => {
  installTestEnv();
  let checkoutSessions = 0;
  const request = new Request("https://scanner.example.test/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkout({ plan: "monitor", billingInterval: "monthly", scanId: undefined }))
  });
  const plan = await inspectedCheckoutPlan(request);
  assert.equal(plan, "monitor");
  const response = await dispatchCheckoutWithEligibility(request, plan, null, null, {
    checkout: async () => {
      checkoutSessions += 1;
      return Response.json({ ok: true }, { status: 201 });
    },
    billingPortal: async () => Response.json({ ok: true, portalUrl: "https://billing.stripe.com/p/unused" })
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "AUTHENTICATION_REQUIRED");
  assert.equal(checkoutSessions, 0);
});

test("rejects subscription checkout before auth or Stripe when the launch flag is closed", async () => {
  installTestEnv();
  process.env.ENABLE_SUBSCRIPTION_CHECKOUT = "false";
  let checkoutSessions = 0;
  const request = new Request("https://scanner.example.test/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkout({ plan: "growth", billingInterval: "annual", scanId: undefined }))
  });
  const response = await dispatchCheckoutWithEligibility(request, "growth", null, null, {
    checkout: async () => {
      checkoutSessions += 1;
      return Response.json({ ok: true }, { status: 201 });
    },
    billingPortal: async () => Response.json({ ok: true }, { status: 201 })
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "PLAN_UNAVAILABLE");
  assert.equal(checkoutSessions, 0);
});

test("sends active and trialing subscribers to billing management without creating another Checkout Session", async () => {
  installTestEnv();
  let checkoutSessions = 0;
  const portalCustomers = [];
  for (const status of ["active", "trialing"]) {
    const request = new Request("https://scanner.example.test/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkout({ plan: "growth", billingInterval: "annual", scanId: undefined }))
    });
    const plan = await inspectedCheckoutPlan(request);
    assert.equal(plan, "growth");
    const response = await dispatchCheckoutWithEligibility(request, plan, {
      verifiedEmail: "verified@example.com",
      ownedCustomerId: "cus_ownedBuyer"
    }, {
      stripeSubscriptionId: `sub_${status}`,
      product: "monitor",
      status
    }, {
      checkout: async () => {
        checkoutSessions += 1;
        return Response.json({ ok: true }, { status: 201 });
      },
      billingPortal: async ({ ownedCustomerId }) => {
        portalCustomers.push(ownedCustomerId);
        return Response.json({
          ok: true,
          portalUrl: "https://billing.stripe.com/p/session/existing"
        }, { status: 201 });
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      ok: true,
      portalUrl: "https://billing.stripe.com/p/session/existing"
    });
  }

  assert.deepEqual(portalCustomers, ["cus_ownedBuyer", "cus_ownedBuyer"]);
  assert.equal(checkoutSessions, 0);
});

test("fails closed when subscription eligibility cannot be verified from account billing data", async () => {
  process.env.SUPABASE_URL = "https://database.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  const originalFetch = globalThis.fetch;
  let lookupUrl = "";
  globalThis.fetch = async (url) => {
    lookupUrl = String(url);
    return new Response("temporarily unavailable", { status: 503 });
  };
  try {
    await assert.rejects(
      findActiveCheckoutSubscription("cus_ownedBuyer"),
      /stripe_subscriptions lookup failed \(503\)/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(lookupUrl, /stripe_subscriptions/);
  assert.match(lookupUrl, /status=in\.%28active%2Ctrialing%29/);
});

test("Stripe form creates an isolated payment customer unless an owned customer is supplied", async () => {
  const originalFetch = globalThis.fetch;
  const forms = [];
  globalThis.fetch = async (_url, init) => {
    forms.push(new URLSearchParams(String(init?.body ?? "")));
    return Response.json({ id: "cs_test_form", url: "https://checkout.stripe.com/c/pay/test" });
  };
  const base = {
    secretKey: "sk_test_contract",
    priceId: "price_report_server",
    mode: "payment",
    plan: "report",
    interval: null,
    email: "buyer@example.com",
    scanId: "91a3e66c-2c07-46cf-ab0c-3768375e050a",
    requestId: "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9",
    successUrl: "https://scanner.example.test/success",
    cancelUrl: "https://scanner.example.test/cancel"
  };
  try {
    await createCheckoutSession({ ...base, customerId: null });
    await createCheckoutSession({ ...base, customerId: "cus_ownedBuyer" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(forms[0].get("customer_creation"), "always");
  assert.equal(forms[0].get("customer_email"), "buyer@example.com");
  assert.equal(forms[0].has("customer"), false);
  assert.equal(forms[1].get("customer"), "cus_ownedBuyer");
  assert.equal(forms[1].has("customer_email"), false);
  assert.equal(forms[1].has("customer_creation"), false);
});

test("billing portal handler accepts only the signed-in account customer supplied by its route", async () => {
  installTestEnv();
  let portalCustomer = null;
  const dependencies = {
    getConfig: getStripeServerConfig,
    createPortal: async (_key, customerId) => {
      portalCustomer = customerId;
      return { url: "https://billing.stripe.com/p/session/test" };
    }
  };
  assert.equal((await handleBillingPortal({ ownedCustomerId: null }, dependencies)).status, 403);
  assert.equal(portalCustomer, null);
  assert.equal((await handleBillingPortal({ ownedCustomerId: "cus_ownedBuyer" }, dependencies)).status, 201);
  assert.equal(portalCustomer, "cus_ownedBuyer");
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
  assert.match(stripeApi, /form\.customer_creation = "always"/);
  assert.match(stripeApi, /Idempotency-Key/);
  assert.doesNotMatch(stripeApi, /process\.env/);
  assert.match(handlers, /const reportPath = `\/reports\/\$\{scanId\}\?checkout=success&session_id=`/);
  assert.match(handlers, /auth\/sign-in\?next=\$\{encodeURIComponent\(reportPath\)\}/);
  assert.match(handlers, /\/dashboard\/onboarding\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(handlers, /verifyStripeSignature\(payload/);
  assert.match(handlers, /reportScanExists/);
  assert.match(checkoutRoute, /session\.user\.email_confirmed_at/);
  assert.match(checkoutRoute, /ownedCustomerId: account\.stripe_customer_id/);
  assert.match(checkoutRoute, /findActiveCheckoutSubscription\(account\.stripe_customer_id\)/);
  assert.match(checkoutRoute, /code: "CHECKOUT_IDENTITY_UNAVAILABLE"/);
  assert.match(checkoutRoute, /dispatchCheckoutWithEligibility\(request, plan, null, null\)/);
  assert.doesNotMatch(checkoutRoute, /resolveCustomerSession[\s\S]*\.catch\(\(\) => null\)/);
  assert.doesNotMatch(portalRoute, /checkoutSessionId|retrieveCheckoutSession/);
});

test("migration derives plans from Price IDs and records conservative payment lifecycle state", async () => {
  const sql = await readFile(new URL("../db/stripe-billing-expansion.sql", import.meta.url), "utf8");
  assert.match(sql, /stripe_event_id text primary key/);
  assert.match(sql, /on conflict \(stripe_event_id\) do nothing/);
  assert.match(sql, /on conflict \(stripe_checkout_session_id\) do update/);
  assert.match(sql, /customer\.subscription\.deleted/);
  assert.match(sql, /charge\.refunded/);
  assert.match(sql, /charge\.dispute\.created/);
  assert.match(sql, /status = 'refunded'/);
  assert.match(sql, /status = 'disputed'/);
  assert.doesNotMatch(sql, /amount_total'\)::bigint = 4900/);
  assert.match(sql, /p_price_catalog->>'report'/);
  assert.match(sql, /when p_price_catalog->>'monitorMonthly' then v_product := 'monitor'; v_interval := 'monthly'/);
  assert.match(sql, /when p_price_catalog->>'growthAnnual' then v_product := 'growth'; v_interval := 'annual'/);
  assert.match(sql, /invoice\.payment_failed/);
  assert.match(sql, /invoice\.payment_action_required/);
  assert.match(sql, /then 'past_due'/);
  assert.match(sql, /else 'incomplete'/);
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
