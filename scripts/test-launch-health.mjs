import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateLaunchHealth } from "../lib/launchHealth.ts";

const [route, healthEvaluator, pricing, report, eligibility, launchCheck] = await Promise.all([
  readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/launchHealth.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/checkoutEligibility.ts", import.meta.url), "utf8"),
  readFile(new URL("./check-launch-env.mjs", import.meta.url), "utf8")
]);

const reportReadyEnvironment = {
  SUPABASE_URL: "https://database.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  SUPABASE_ANON_KEY: "anon-test",
  OPENAI_API_KEY: "openai-test",
  SCAN_RATE_LIMIT_HASH_SECRET: "rate-limit-test",
  STRIPE_SECRET_KEY: "sk_live_health",
  STRIPE_WEBHOOK_SECRET: "whsec_health",
  STRIPE_PRICE_REPORT: "price_report",
  RESEND_API_KEY: "resend-test",
  RESEND_FROM_EMAIL: "scanner@example.test",
  OPPORTUNITY_SCANNER_CONTACT_EMAIL: "support@example.test",
  NEXT_PUBLIC_POSTHOG_KEY: "posthog-test",
  NEXT_PUBLIC_POSTHOG_HOST: "https://analytics.example.test",
  ENABLE_PAID_REPORT_CHECKOUT: "true",
  CRON_SECRET: "cron-test"
};

const reportOnly = evaluateLaunchHealth(reportReadyEnvironment);
assert.equal(reportOnly.ready.demo, true);
assert.equal(reportOnly.ready.paidSignup, true);
assert.equal(reportOnly.ready.reportCheckout, true);
assert.equal(reportOnly.ready.subscriptionCheckout, false);
assert.equal(reportOnly.services.email, true);
assert.equal(reportOnly.services.support, true);
assert.equal(reportOnly.services.analytics, true);
assert.equal(reportOnly.services.reportCheckoutEnabled, true);
assert.equal(reportOnly.services.reportCatalog, "unverified");

const invalidReportCatalog = evaluateLaunchHealth(reportReadyEnvironment, {
  ok: false,
  reason: "The configured Report price must be USD $49.00.",
  checkedAt: "2026-07-14T12:00:00.000Z"
});
assert.equal(invalidReportCatalog.ok, true, "catalog failure must not make core demo health fragile");
assert.equal(invalidReportCatalog.ready.paidSignup, false);
assert.equal(invalidReportCatalog.ready.reportCheckout, false);
assert.equal(invalidReportCatalog.services.reportCatalog, "invalid");
assert.equal(invalidReportCatalog.services.reportCatalogReason, "The configured Report price must be USD $49.00.");

const verifiedReportCatalog = evaluateLaunchHealth(reportReadyEnvironment, {
  ok: true,
  reason: "Configured Report price verified.",
  checkedAt: "2026-07-14T12:00:00.000Z"
});
assert.equal(verifiedReportCatalog.ready.reportCheckout, true);
assert.equal(verifiedReportCatalog.services.reportCatalog, "verified");

const reportCheckoutDisabled = evaluateLaunchHealth({
  ...reportReadyEnvironment,
  ENABLE_PAID_REPORT_CHECKOUT: "false"
});
assert.equal(reportCheckoutDisabled.services.reportCheckoutEnabled, false);
assert.equal(reportCheckoutDisabled.ready.paidSignup, false);
assert.equal(reportCheckoutDisabled.ready.reportCheckout, false);

for (const missing of ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
  const environment = { ...reportReadyEnvironment, [missing]: "" };
  const health = evaluateLaunchHealth(environment);
  assert.equal(health.services.email, false, `${missing} must close customer email readiness`);
  assert.equal(health.ready.paidSignup, false);
  assert.equal(health.ready.reportCheckout, false);
}

const invalidSender = evaluateLaunchHealth({
  ...reportReadyEnvironment,
  RESEND_FROM_EMAIL: "not-an-email"
});
assert.equal(invalidSender.services.email, false);
assert.equal(invalidSender.ready.reportCheckout, false);

for (const contactEmail of ["", "not-an-email"]) {
  const health = evaluateLaunchHealth({
    ...reportReadyEnvironment,
    OPPORTUNITY_SCANNER_CONTACT_EMAIL: contactEmail
  });
  assert.equal(health.services.support, false);
  assert.equal(health.ready.paidSignup, false);
  assert.equal(health.ready.reportCheckout, false);
}

for (const missing of ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"]) {
  const environment = { ...reportReadyEnvironment, [missing]: "" };
  const health = evaluateLaunchHealth(environment);
  assert.equal(health.services.analytics, false, `${missing} must close analytics readiness`);
  assert.equal(health.ready.paidSignup, false);
  assert.equal(health.ready.reportCheckout, false);
}

const subscriptionPrices = {
  STRIPE_PRICE_MONITOR_MONTHLY: "price_monitor_monthly",
  STRIPE_PRICE_MONITOR_ANNUAL: "price_monitor_annual",
  STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_monthly",
  STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_annual"
};
assert.equal(
  evaluateLaunchHealth({ ...reportReadyEnvironment, ...subscriptionPrices }).ready.subscriptionCheckout,
  false,
  "subscription prices alone must not enable checkout"
);
assert.equal(
  evaluateLaunchHealth({
    ...reportReadyEnvironment,
    ENABLE_SUBSCRIPTION_CHECKOUT: "true"
  }).ready.subscriptionCheckout,
  false,
  "the flag alone must not enable checkout"
);
assert.equal(
  evaluateLaunchHealth({
    ...reportReadyEnvironment,
    ...subscriptionPrices,
    ENABLE_SUBSCRIPTION_CHECKOUT: "true"
  }).ready.subscriptionCheckout,
  true
);

assert.match(healthEvaluator, /reportCheckoutEnabled/);
assert.match(healthEvaluator, /mode === "live"/);
assert.match(healthEvaluator, /subscriptionsEnabled && subscriptionPrices/);
assert.match(route, /evaluateLaunchHealth\(process\.env\)/);
assert.match(route, /verifyReportCatalogCached\(getStripeServerConfig\(\)\)/);
assert.match(route, /REPORT_CATALOG_HEALTH_TIMEOUT_MS = 1_500/);
assert.match(route, /status: health\.ready\.demo \? 200 : 503/);
assert.match(route, /VERCEL_GIT_COMMIT_SHA\?\.slice\(0, 12\)/);
assert.match(route, /"Cache-Control": "no-store"/);
assert.doesNotMatch(healthEvaluator, /STRIPE_SECRET_KEY[^\n]*(?:return|json)/i);
assert.doesNotMatch(healthEvaluator, /SUPABASE_SERVICE_ROLE_KEY[^\n]*(?:return|json)/i);
assert.match(pricing, /checkoutPlan === "report" \? checkout\.report : checkout\.subscriptions/);
assert.match(pricing, /Monitor and Growth are not open for purchase yet/);
assert.match(report, /subscriptionCheckoutIsConfigured\(\)/);
assert.match(eligibility, /code: "PLAN_UNAVAILABLE"/);
assert.match(eligibility, /reportCheckoutIsEnabled\(\)/);
assert.match(eligibility, /subscriptionCheckoutIsEnabled\(\)/);
assert.match(launchCheck, /ENABLE_SUBSCRIPTION_CHECKOUT/);
assert.match(launchCheck, /ENABLE_PAID_REPORT_CHECKOUT/);
assert.match(launchCheck, /requires all Monitor and Growth Stripe Price IDs/);

console.log("Paid launch gating and health contract passed without exposing configuration values.");
