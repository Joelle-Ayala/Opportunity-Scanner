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
assert.match(snapshot.notes.join(" "), /excludes emails, company URLs, and report IDs/);
assert.match(snapshot.notes.join(" "), /safety limit/);

console.log("Privacy-safe launch funnel checks passed.");
