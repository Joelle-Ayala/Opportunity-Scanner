import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  evaluatePaidOpsHealth,
  loadPaidOperationalSnapshot,
  paidOpsHealthStatus
} from "../lib/payments/paidOpsHealth.ts";

const NOW = new Date("2026-07-14T16:00:00.000Z");
const privateFixtureValues = [
  "sk_live_fixture_private",
  "whsec_fixture_private",
  "service-role-private",
  "buyer.private@example.test",
  "evt_PrivateFixture123",
  "cus_PrivateFixture123",
  "price_PrivateFixture123",
  "prod_PrivateFixture123",
  "cs_live_PrivateFixture123",
  "pi_PrivateFixture123",
  "91a3e66c-2c07-46cf-ab0c-3768375e050a"
];

const readyEnvironment = {
  SUPABASE_URL: "https://database.example.test",
  SUPABASE_SERVICE_ROLE_KEY: privateFixtureValues[2],
  SUPABASE_ANON_KEY: "anon-private",
  OPENAI_API_KEY: "openai-private",
  SCAN_RATE_LIMIT_HASH_SECRET: "rate-limit-private",
  STRIPE_SECRET_KEY: privateFixtureValues[0],
  STRIPE_WEBHOOK_SECRET: privateFixtureValues[1],
  APP_URL: "https://scanner.example.test",
  STRIPE_PRICE_REPORT: "price_report_fixture",
  RESEND_API_KEY: "resend-private",
  RESEND_FROM_EMAIL: "scanner@example.test",
  OPPORTUNITY_SCANNER_CONTACT_EMAIL: "support@example.test",
  NEXT_PUBLIC_POSTHOG_KEY: "posthog-private",
  NEXT_PUBLIC_POSTHOG_HOST: "https://analytics.example.test",
  ENABLE_PAID_REPORT_CHECKOUT: "true"
};

function healthySnapshot(overrides = {}) {
  return {
    recentWebhookCount: 4,
    latestWebhookProcessedAt: "2026-07-14T15:55:00.000Z",
    pendingDeliveries: 1,
    stalePendingDeliveries: 0,
    failedDeliveries: 0,
    activeGrants: 7,
    refundedGrants: 1,
    disputedGrants: 1,
    claimedActiveGrants: 5,
    deliveredRecoveryGrants: 7,
    activeGrantsWithoutDeliveryAttempt: 0,
    ...overrides
  };
}

function fixtureDependencies(snapshot = healthySnapshot(), catalogOverrides = {}) {
  return {
    now: () => NOW,
    checkCatalog: async () => ({
      ok: true,
      code: "VERIFIED",
      reason: `Configured Report price verified without ${privateFixtureValues.join(" ")}`,
      checkedAt: NOW.toISOString(),
      ...catalogOverrides
    }),
    loadOperationalSnapshot: async () => snapshot
  };
}

const healthy = await evaluatePaidOpsHealth(readyEnvironment, fixtureDependencies());
assert.equal(healthy.ok, true);
assert.equal(healthy.ready.paidReport, true);
assert.equal(paidOpsHealthStatus(healthy), 200);
assert.deepEqual(healthy.checks.delivery, {
  ok: true,
  pending: 1,
  stalePending: 0,
  failed: 0,
  pendingGraceMinutes: 15
});
assert.deepEqual(healthy.checks.grants, {
  ok: true,
  active: 7,
  refunded: 1,
  disputed: 1
});
assert.deepEqual(healthy.checks.claimRecovery, {
  ok: true,
  claimedActive: 5,
  unclaimedActive: 2,
  deliveredRecovery: 7,
  activeWithoutDeliveryAttempt: 0
});

const serializedHealthy = JSON.stringify(healthy);
for (const privateValue of privateFixtureValues) {
  assert.doesNotMatch(serializedHealthy, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}
assert.doesNotMatch(serializedHealthy, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
assert.doesNotMatch(
  serializedHealthy,
  /(?:sk_(?:live|test)|whsec_|evt_|cus_|price_|prod_|cs_(?:live|test)_|pi_)[A-Za-z0-9_]*/i
);
assert.doesNotMatch(serializedHealthy, /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);

const originalFetch = globalThis.fetch;
const databaseRequests = [];
globalThis.fetch = async (url, init = {}) => {
  databaseRequests.push({ url: String(url), init });
  const parsed = new URL(String(url));
  const table = parsed.pathname.split("/").at(-1);
  const status = parsed.searchParams.get("status");
  const select = parsed.searchParams.get("select") ?? "";
  const response = (count, rows = null) => new Response(rows === null ? null : JSON.stringify(rows), {
    status: 200,
    headers: {
      "Content-Range": count === 0 ? "*/0" : `0-${Math.max(0, (rows?.length ?? 1) - 1)}/${count}`,
      ...(rows === null ? {} : { "Content-Type": "application/json" })
    }
  });

  if (table === "stripe_webhook_events") {
    return response(4, [{ processed_at: "2026-07-14T15:55:00.000Z" }]);
  }
  if (table === "paid_report_delivery_attempts" && status === "in.(pending,failed)") {
    return response(1, [{ status: "pending", updated_at: "2026-07-14T15:55:00.000Z" }]);
  }
  if (table === "customer_report_grant_ownership") return response(5);
  if (table === "paid_report_delivery_attempts" && status === "eq.delivered") return response(7);
  if (table === "stripe_report_access_grants" && select.includes("paid_report_delivery_attempts")) return response(0);
  if (table === "stripe_report_access_grants" && status === "eq.active") return response(7);
  if (table === "stripe_report_access_grants" && status === "eq.refunded") return response(1);
  if (table === "stripe_report_access_grants" && status === "eq.disputed") return response(1);
  return new Response(null, { status: 500 });
};

let queriedSnapshot;
try {
  queriedSnapshot = await loadPaidOperationalSnapshot(readyEnvironment, NOW);
} finally {
  globalThis.fetch = originalFetch;
}
assert.deepEqual(queriedSnapshot, healthySnapshot());
assert.equal(databaseRequests.length, 8);
const missingDeliveryRequest = databaseRequests.find(({ url }) => {
  const parsed = new URL(url);
  return parsed.pathname.endsWith("/stripe_report_access_grants")
    && (parsed.searchParams.get("select") ?? "").includes("paid_report_delivery_attempts");
});
assert.ok(missingDeliveryRequest, "active grants without delivery attempts must be queried");
assert.equal(
  new URL(missingDeliveryRequest.url).searchParams.get("paid_report_delivery_attempts.id"),
  "is.null"
);
for (const request of databaseRequests) {
  assert.equal(request.init.cache, "no-store");
  assert.match(request.init.headers.Prefer, /count=exact/);
  assert.doesNotMatch(request.url, /email|stripe_event_id|stripe_customer_id|scan_id|checkout_session|payment_intent/i);
}

const unhealthyFixtures = [
  ["Report launch flag", { ...readyEnvironment, ENABLE_PAID_REPORT_CHECKOUT: "false" }, healthySnapshot()],
  ["live Stripe", { ...readyEnvironment, STRIPE_SECRET_KEY: "sk_test_fixture" }, healthySnapshot()],
  ["recent webhook persistence", readyEnvironment, healthySnapshot({ recentWebhookCount: 0, latestWebhookProcessedAt: null })],
  ["failed paid delivery", readyEnvironment, healthySnapshot({ failedDeliveries: 1 })],
  ["stale pending delivery", readyEnvironment, healthySnapshot({ pendingDeliveries: 1, stalePendingDeliveries: 1 })],
  ["grant recovery coverage", readyEnvironment, healthySnapshot({ activeGrantsWithoutDeliveryAttempt: 1 })]
];

for (const [label, environment, snapshot] of unhealthyFixtures) {
  const health = await evaluatePaidOpsHealth(environment, fixtureDependencies(snapshot));
  assert.equal(health.ok, false, `${label} must fail closed`);
  assert.equal(health.ready.paidReport, false, `${label} must close paid Report readiness`);
  assert.equal(paidOpsHealthStatus(health), 503, `${label} must return unavailable`);
}

const invalidCatalog = await evaluatePaidOpsHealth(
  readyEnvironment,
  fixtureDependencies(healthySnapshot(), {
    ok: false,
    code: "AMOUNT_MISMATCH",
    reason: `private catalog detail ${privateFixtureValues.join(" ")}`
  })
);
assert.equal(invalidCatalog.checks.catalog.status, "invalid");
assert.equal(paidOpsHealthStatus(invalidCatalog), 503);
for (const privateValue of privateFixtureValues) {
  assert.doesNotMatch(JSON.stringify(invalidCatalog), new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

const databaseFailure = await evaluatePaidOpsHealth(readyEnvironment, {
  ...fixtureDependencies(),
  loadOperationalSnapshot: async () => {
    throw new Error(`database failed for ${privateFixtureValues.join(" ")}`);
  }
});
assert.equal(databaseFailure.ok, false);
assert.equal(paidOpsHealthStatus(databaseFailure), 503);
assert.equal(databaseFailure.checks.webhooks.recentPersisted, null);
assert.equal(databaseFailure.checks.delivery.failed, null);
assert.doesNotMatch(JSON.stringify(databaseFailure), /private|@example\.test|sk_live_|whsec_|evt_|cus_/i);

const route = await readFile(new URL("../app/api/health/paid/route.ts", import.meta.url), "utf8");
const demoRoute = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
assert.match(route, /dynamic = "force-dynamic"/);
assert.match(route, /revalidate = 0/);
assert.match(route, /timingSafeEqual/);
assert.match(route, /process\.env\.CRON_SECRET/);
assert.match(route, /status: 401/);
assert.match(route, /Unauthorized\./);
assert.match(route, /paidOpsHealthStatus\(health\)/);
assert.match(route, /"Cache-Control": "no-store, no-cache, must-revalidate/);
assert.match(route, /"CDN-Cache-Control": "no-store"/);
assert.match(route, /"Vercel-CDN-Cache-Control": "no-store"/);
assert.match(route, /Pragma: "no-cache"/);
assert.match(demoRoute, /status: health\.ready\.demo \? 200 : 503/);

console.log("Paid operations health fixtures passed 200/503, fail-closed, and privacy checks.");
