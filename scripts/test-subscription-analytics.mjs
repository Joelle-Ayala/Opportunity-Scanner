import assert from "node:assert/strict";
import { buildSubscriptionLifecycleAnalytics } from "../lib/subscriptionAnalytics.ts";

const now = new Date("2026-07-23T12:00:00.000Z");
const startedAt = new Date("2026-07-16T12:00:00.000Z");
const analytics = buildSubscriptionLifecycleAnalytics({
  now,
  startedAt,
  subscriptions: [
    {
      stripe_customer_id: "customer-a",
      product: "monitor",
      billing_interval: "monthly",
      status: "active",
      livemode: true,
      created_at: "2026-07-17T10:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-b",
      product: "growth",
      billing_interval: "annual",
      status: "active",
      livemode: true,
      created_at: "2026-07-18T10:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-c",
      product: "growth",
      billing_interval: "monthly",
      status: "canceled",
      livemode: true,
      created_at: "2026-07-16T13:00:00.000Z",
      canceled_at: "2026-07-22T10:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-unpaid",
      product: "growth",
      billing_interval: "monthly",
      status: "unpaid",
      livemode: true,
      created_at: "2026-07-20T10:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-test",
      product: "growth",
      billing_interval: "monthly",
      status: "active",
      livemode: false,
      created_at: "2026-07-17T10:00:00.000Z"
    }
  ],
  profiles: [
    {
      stripe_customer_id: "customer-a",
      status: "active",
      created_at: "2026-07-17T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-c",
      status: "canceled",
      created_at: "2026-07-17T13:00:00.000Z"
    }
  ]
});

assert.deepEqual(analytics.purchaseToActivationRate, {
  status: "available",
  value: { numerator: 2, denominator: 4, percent: 50 }
});
assert.deepEqual(analytics.medianActivationHours, { status: "available", value: 13 });
assert.deepEqual(analytics.activeWithZeroProfileCount, { status: "available", value: 1 });
assert.deepEqual(analytics.churnMrr, { status: "available", value: 249 });
assert.deepEqual(analytics.retentionByPlan, {
  status: "available",
  value: {
    monitor: { retainedSubscriptions: 1, cohortSubscriptions: 1, retentionRate: 100 },
    growth: { retainedSubscriptions: 1, cohortSubscriptions: 3, retentionRate: 33.3 }
  }
});
for (const unavailableMetric of [
  analytics.expansionMrr,
  analytics.contractionMrr,
  analytics.pastDueRecoveryRate
]) {
  assert.equal(unavailableMetric.status, "unavailable");
  assert.equal(unavailableMetric.value, null);
  assert.match(unavailableMetric.reason, /latest state/);
}
assert.doesNotMatch(
  JSON.stringify(analytics),
  /customer-a|customer-b|customer-c|stripe_customer_id|stripe_subscription_id|monitored_profile_id/
);

const unavailable = buildSubscriptionLifecycleAnalytics({
  now,
  startedAt
});
assert.equal(unavailable.purchaseToActivationRate.status, "unavailable");
assert.equal(unavailable.activeWithZeroProfileCount.status, "unavailable");
assert.equal(unavailable.churnMrr.status, "unavailable");
assert.equal(unavailable.retentionByPlan.status, "unavailable");

const empty = buildSubscriptionLifecycleAnalytics({
  now,
  startedAt,
  subscriptions: [],
  profiles: []
});
assert.deepEqual(empty.purchaseToActivationRate, {
  status: "available",
  value: { numerator: 0, denominator: 0, percent: 0 }
});
assert.equal(empty.medianActivationHours.status, "unavailable");
assert.deepEqual(empty.activeWithZeroProfileCount, { status: "available", value: 0 });
assert.deepEqual(empty.churnMrr, { status: "available", value: 0 });

const unpaidWithProfile = buildSubscriptionLifecycleAnalytics({
  now,
  startedAt,
  subscriptions: [
    {
      stripe_customer_id: "customer-unpaid-activated",
      product: "monitor",
      billing_interval: "monthly",
      status: "unpaid",
      livemode: true,
      created_at: "2026-07-20T10:00:00.000Z"
    }
  ],
  profiles: [
    {
      stripe_customer_id: "customer-unpaid-activated",
      status: "active",
      created_at: "2026-07-20T11:00:00.000Z"
    }
  ]
});
assert.deepEqual(unpaidWithProfile.purchaseToActivationRate, {
  status: "available",
  value: { numerator: 1, denominator: 1, percent: 100 }
});
assert.deepEqual(unpaidWithProfile.retentionByPlan, {
  status: "available",
  value: {
    monitor: { retainedSubscriptions: 0, cohortSubscriptions: 1, retentionRate: 0 },
    growth: { retainedSubscriptions: 0, cohortSubscriptions: 0, retentionRate: 0 }
  }
});

console.log("Aggregate subscription lifecycle analytics checks passed.");
