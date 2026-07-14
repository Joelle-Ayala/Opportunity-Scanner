import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findNewMonitoringSignals,
  monitoringOpportunityKey,
  nextMonitoringRunAt
} from "../lib/monitoring/core.ts";
import {
  getMonitoringEmailConfig,
  monitoringReportUrl,
  sendMonitoringAlertEmail
} from "../lib/monitoring/delivery.ts";

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
  assert.match(
    route,
    /executeScanPipeline\(scan\.id, input, \{[\s\S]*?deadlineAtMs: executionDeadlineAtMs,[\s\S]*?terminalDeadlineAtMs/
  );
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
  assert.match(route, /claimPendingMonitoringAlerts\(5\)/);
  assert.match(route, /executeScanPipeline\(scan\.id, input\)/);
  assert.match(route, /findNewMonitoringSignals/);
  assert.match(storage, /record_monitoring_alerts/);
  assert.match(storage, /monitoringOpportunityKey/);
  assert.match(storage, /provider_message_id/);
  assert.match(storage, /nextMonitoringRunAt/);
  assert.match(storage, /lease_expires_at: null/);
});

test("Hobby-compatible Vercel cron runs monitoring once per day", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(
    config.crons.find((job) => job.path === "/api/cron/monitoring"),
    { path: "/api/cron/monitoring", schedule: "17 12 * * *" }
  );
  assert.ok(config.crons.length <= 2, "Vercel Hobby supports at most two cron jobs");
});

test("alert delivery migration deduplicates, leases, and resolves Stripe email server-side", async () => {
  const sql = await readFile(
    new URL("../db/monitoring-alert-delivery.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /attempt_count integer not null default 0/);
  assert.match(sql, /last_attempt_at timestamptz/);
  assert.match(sql, /next_attempt_at timestamptz/);
  assert.match(sql, /delivery_lease_expires_at timestamptz/);
  assert.match(sql, /provider_message_id text/);
  assert.match(sql, /monitoring_alerts_profile_dedupe_idx/);
  assert.match(sql, /on conflict \(monitored_profile_id, alert_kind, dedupe_key\)/);
  assert.match(sql, /for update of alert skip locked/);
  assert.match(sql, /join stripe_customers customer/);
  assert.match(sql, /customer\.email/);
  assert.match(sql, /attempt_count < 5/);
  assert.match(sql, /grant execute on function claim_pending_monitoring_alerts\(integer\) to service_role/);
});

test("email delivery stays disabled until Resend and a verified sender are configured", () => {
  assert.equal(getMonitoringEmailConfig({ APP_URL: "https://scanner.example.test" }), null);
  assert.equal(
    getMonitoringEmailConfig({
      APP_URL: "https://scanner.example.test",
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "not-an-email"
    }),
    null
  );
  assert.deepEqual(
    getMonitoringEmailConfig({
      APP_URL: "https://scanner.example.test/",
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "alerts@example.test"
    }),
    {
      apiKey: "re_test",
      fromEmail: "alerts@example.test",
      appUrl: "https://scanner.example.test"
    }
  );
});

test("Resend REST delivery is concise, idempotent, and links to the report", async () => {
  const config = {
    apiKey: "re_test",
    fromEmail: "alerts@example.test",
    appUrl: "https://scanner.example.test"
  };
  const alert = {
    alert_id: "alert-123",
    monitoring_run_id: "run-123",
    scan_id: "scan-123",
    recipient_email: "customer@example.test",
    opportunity_title: "City arts grant",
    agency_or_funder: "Example City",
    deadline: "2026-09-01",
    attempt_count: 1
  };
  let request;
  const providerId = await sendMonitoringAlertEmail(config, alert, async (url, init) => {
    request = { url, init, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ id: "email-123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  assert.equal(providerId, "email-123");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.headers["Idempotency-Key"], "monitoring-alert/alert-123");
  assert.deepEqual(request.body.to, ["customer@example.test"]);
  assert.match(request.body.subject, /City arts grant/);
  assert.match(request.body.text, /https:\/\/scanner\.example\.test\/reports\/scan-123/);
  assert.equal(monitoringReportUrl(config, "scan/123"), "https://scanner.example.test/reports/scan%2F123");
});

test("monitoring env example documents delivery names without values", async () => {
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(env, /^CRON_SECRET=$/m);
  assert.match(env, /^RESEND_API_KEY=$/m);
  assert.match(env, /^RESEND_FROM_EMAIL=$/m);
});
