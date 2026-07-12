import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findNewMonitoringSignals,
  monitoringOpportunityKey,
  nextMonitoringRunAt
} from "../lib/monitoring/core.ts";

function signal(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    source_url: "https://example.gov/opportunity/123",
    source_name: "Example source",
    opportunity_title: "Example opportunity",
    agency_or_funder: "Example agency",
    show_in_report: true,
    ...overrides
  };
}

test("calculates daily and weekly monitoring schedules", () => {
  const start = new Date("2026-07-12T12:00:00.000Z");
  assert.equal(nextMonitoringRunAt("daily", start).toISOString(), "2026-07-13T12:00:00.000Z");
  assert.equal(nextMonitoringRunAt("weekly", start).toISOString(), "2026-07-19T12:00:00.000Z");
});

test("normalizes source URLs before comparing opportunities", () => {
  assert.equal(
    monitoringOpportunityKey(signal({ source_url: "HTTPS://EXAMPLE.GOV/opportunity/123/#details" })),
    "url:https://example.gov/opportunity/123"
  );
});

test("returns only genuinely new visible opportunities", () => {
  const existing = signal();
  const fresh = signal({ id: crypto.randomUUID(), source_url: "https://example.gov/opportunity/456" });
  const hidden = signal({ id: crypto.randomUUID(), source_url: "https://example.gov/opportunity/789", show_in_report: false });
  const result = findNewMonitoringSignals([existing], [existing, fresh, hidden]);
  assert.deepEqual(result.map((item) => item.source_url), [fresh.source_url]);
});

test("monitoring schema is subscription-gated, leased, and private", async () => {
  const sql = await readFile(new URL("../db/monitoring.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists monitored_profiles/);
  assert.match(sql, /create table if not exists monitoring_runs/);
  assert.match(sql, /create table if not exists monitoring_alerts/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /subscription\.status in \('active', 'trialing'\)/);
  assert.match(sql, /alter table monitored_profiles enable row level security/);
  assert.match(sql, /grant execute on function claim_due_monitored_profiles\(integer\) to service_role/);
});

test("customer scans and future scheduled scans share one pipeline", async () => {
  const [route, pipeline] = await Promise.all([
    readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scanPipeline.ts", import.meta.url), "utf8")
  ]);
  assert.match(route, /executeScanPipeline\(scan\.id, input\)/);
  assert.match(pipeline, /discoverExternalSignalsWithStatus/);
  assert.match(pipeline, /saveOpportunitySignals/);
  assert.match(pipeline, /status: "completed"/);
});

test("cron monitoring is secret-protected and writes durable run outcomes", async () => {
  const [route, storage] = await Promise.all([
    readFile(new URL("../app/api/cron/monitoring/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/monitoring/storage.ts", import.meta.url), "utf8")
  ]);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /claimDueMonitoredProfiles\(1\)/);
  assert.match(route, /executeScanPipeline\(scan\.id, input\)/);
  assert.match(route, /findNewMonitoringSignals/);
  assert.match(storage, /delivery_status: "pending"/);
  assert.match(storage, /nextMonitoringRunAt/);
  assert.match(storage, /lease_expires_at: null/);
});
