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
      product: "monitor",
      billing_interval: "monthly",
      status: "active",
      livemode: true,
      created_at: "2026-07-13T12:00:00.000Z",
      client_supplied_amount: 999_999
    },
    {
      product: "monitor",
      billing_interval: "annual",
      status: "active",
      livemode: true,
      created_at: "2026-07-10T12:00:00.000Z"
    },
    {
      product: "growth",
      billing_interval: "annual",
      status: "active",
      livemode: true,
      created_at: "2026-06-10T12:00:00.000Z"
    },
    {
      product: "growth",
      billing_interval: "monthly",
      status: "trialing",
      livemode: true,
      created_at: "2026-07-12T12:00:00.000Z"
    },
    {
      product: "growth",
      billing_interval: "monthly",
      status: "past_due",
      livemode: true,
      created_at: "2026-07-11T12:00:00.000Z"
    },
    {
      product: "monitor",
      billing_interval: "monthly",
      status: "canceled",
      livemode: true,
      created_at: "2026-07-09T12:00:00.000Z",
      canceled_at: "2026-07-13T18:00:00.000Z"
    },
    {
      product: "monitor",
      billing_interval: "monthly",
      status: "active",
      livemode: false,
      created_at: "2026-07-13T12:00:00.000Z"
    },
    {
      product: "client_supplied_plan",
      billing_interval: "monthly",
      status: "active",
      livemode: true,
      created_at: "2026-07-13T12:00:00.000Z"
    },
    {
      product: "monitor",
      billing_interval: "monthly",
      status: "incomplete",
      livemode: true,
      created_at: "2026-07-13T12:00:00.000Z"
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
