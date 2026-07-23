import assert from "node:assert/strict";
import { buildLaunchFunnelSnapshot } from "../lib/launchFunnel.ts";

const snapshot = buildLaunchFunnelSnapshot({
  now: new Date("2026-07-14T12:00:00.000Z"),
  days: 7,
  scans: [
    {
      id: "scan-paid",
      status: "completed",
      created_at: "2026-07-13T12:00:00.000Z",
      utm_source: "linkedin",
      utm_medium: "paid_social",
      utm_campaign: "report-launch"
    },
    {
      id: "scan-refunded",
      status: "completed",
      created_at: "2026-07-12T12:00:00.000Z",
      utm_source: "linkedin",
      utm_medium: "paid_social",
      utm_campaign: "report-launch"
    },
    {
      id: "scan-direct",
      status: "failed",
      created_at: "2026-07-11T12:00:00.000Z"
    },
    {
      id: "scan-old",
      status: "completed",
      created_at: "2026-06-01T12:00:00.000Z",
      utm_source: "ignore-me"
    },
    { id: "scan-invalid", status: "completed", created_at: "not-a-date" }
  ],
  grants: [
    { scan_id: "scan-paid", status: "active" },
    { scan_id: "scan-paid", status: "refunded" },
    { scan_id: "scan-refunded", status: "refunded" }
  ],
  subscriptions: [
    {
      stripe_customer_id: "customer-a",
      product: "monitor",
      billing_interval: "monthly",
      status: "active",
      livemode: true,
      created_at: "2026-07-13T12:00:00.000Z",
      client_supplied_amount: 999_999
    },
    {
      stripe_customer_id: "customer-b",
      product: "monitor",
      billing_interval: "annual",
      status: "active",
      livemode: true,
      created_at: "2026-07-10T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-c",
      product: "growth",
      billing_interval: "annual",
      status: "active",
      livemode: true,
      created_at: "2026-06-10T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-d",
      product: "growth",
      billing_interval: "monthly",
      status: "trialing",
      livemode: true,
      created_at: "2026-07-12T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-e",
      product: "growth",
      billing_interval: "monthly",
      status: "past_due",
      livemode: true,
      created_at: "2026-07-11T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-f",
      product: "monitor",
      billing_interval: "monthly",
      status: "canceled",
      livemode: true,
      created_at: "2026-07-09T12:00:00.000Z",
      canceled_at: "2026-07-13T18:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-test",
      product: "monitor",
      billing_interval: "monthly",
      status: "active",
      livemode: false,
      created_at: "2026-07-13T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-invalid-plan",
      product: "client_supplied_plan",
      billing_interval: "monthly",
      status: "active",
      livemode: true,
      created_at: "2026-07-13T12:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-incomplete",
      product: "monitor",
      billing_interval: "monthly",
      status: "incomplete",
      livemode: true,
      created_at: "2026-07-13T12:00:00.000Z"
    }
  ],
  profiles: [
    {
      stripe_customer_id: "customer-a",
      status: "active",
      created_at: "2026-07-13T14:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-d",
      status: "active",
      created_at: "2026-07-12T22:00:00.000Z"
    },
    {
      stripe_customer_id: "customer-f",
      status: "canceled",
      created_at: "2026-07-10T12:00:00.000Z"
    }
  ],
  capped: true
});

assert.deepEqual(snapshot.totals, {
  scans: 3,
  completed: 2,
  failed: 1,
  inProgress: 0,
  activePaidReports: 1,
  refundedReports: 1,
  disputedReports: 0,
  completionRate: 66.7,
  paidConversionRate: 50
});
assert.equal(snapshot.segments.length, 2);
assert.deepEqual(snapshot.segments[0], {
  source: "linkedin",
  medium: "paid_social",
  campaign: "report-launch",
  scans: 2,
  completed: 2,
  failed: 0,
  inProgress: 0,
  activePaidReports: 1,
  refundedReports: 1,
  disputedReports: 0,
  completionRate: 100,
  paidConversionRate: 50
});
assert.equal(snapshot.segments[1].source, "direct_or_unknown");
assert.deepEqual(snapshot.mrrScorecard, {
  currency: "USD",
  targetMrr: 10_000,
  activeNormalizedMrr: 389,
  remainingToTarget: 9_611,
  progressToTarget: 3.9,
  activeSubscriptions: 3,
  planMix: {
    monthly: { activeSubscriptions: 1, normalizedMrr: 99, subscriptionShare: 33.3 },
    annual: { activeSubscriptions: 2, normalizedMrr: 290, subscriptionShare: 66.7 }
  },
  productMix: {
    monitor: { activeSubscriptions: 2, normalizedMrr: 181.5, subscriptionShare: 66.7 },
    growth: { activeSubscriptions: 1, normalizedMrr: 207.5, subscriptionShare: 33.3 }
  },
  newSubscriptions: 5,
  canceledSubscriptions: 1,
  pastDueSubscriptions: 1,
  lifecycle: {
    purchaseToActivationRate: {
      status: "available",
      value: { numerator: 3, denominator: 5, percent: 60 }
    },
    medianActivationHours: {
      status: "available",
      value: 10
    },
    activeWithZeroProfileCount: {
      status: "available",
      value: 2
    },
    expansionMrr: {
      status: "unavailable",
      value: null,
      reason: "Unavailable: stored subscriptions contain only the latest state, not prior plan or status transitions."
    },
    contractionMrr: {
      status: "unavailable",
      value: null,
      reason: "Unavailable: stored subscriptions contain only the latest state, not prior plan or status transitions."
    },
    churnMrr: { status: "available", value: 99 },
    pastDueRecoveryRate: {
      status: "unavailable",
      value: null,
      reason: "Unavailable: stored subscriptions contain only the latest state, not prior plan or status transitions."
    },
    retentionByPlan: {
      status: "available",
      value: {
        monitor: { retainedSubscriptions: 2, cohortSubscriptions: 3, retentionRate: 66.7 },
        growth: { retainedSubscriptions: 1, cohortSubscriptions: 2, retentionRate: 50 }
      }
    },
    notes: [
      "Activation means a live subscription purchase was followed by creation of a monitoring profile for the same customer.",
      "Retention is the share of subscriptions created in this reporting window that remain active or trialing, grouped by their latest stored plan.",
      "Churn MRR uses the final stored catalog plan for subscriptions canceled during this reporting window.",
      "All output is aggregate; customer, subscription, profile, and report identifiers are excluded."
    ]
  },
  notes: [
    "MRR uses the fixed Monitor and Growth catalog values; annual contract value is divided by 12.",
    "Only live-mode, server-normalized catalog subscriptions with active status contribute to MRR and plan mix.",
    "New and canceled counts use this reporting window; past-due is the current aggregate count."
  ]
});
const serializedSnapshot = JSON.stringify(snapshot);
assert.doesNotMatch(serializedSnapshot, /"(?:client_supplied_amount|stripe_[^"]*|customer_[^"]*|email)"\s*:/i);
assert.match(snapshot.notes.join(" "), /excludes emails, company URLs, and report IDs/);
assert.match(snapshot.notes.join(" "), /safety limit/);

console.log("Privacy-safe launch funnel checks passed.");
