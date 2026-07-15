import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
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
import {
  MONITORING_INITIAL_RETRY_MS,
  MONITORING_MAX_FAILURE_ATTEMPTS,
  MONITORING_MAX_RETRY_MS,
  monitoringFailureRetryDelayMs,
  nextMonitoringFailureRetryAt
} from "../lib/monitoring/storage.ts";

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

test("failed monitoring scans retry shortly instead of skipping the cadence", async () => {
  const failedAt = new Date("2026-07-12T12:00:00.000Z");
  assert.equal(MONITORING_INITIAL_RETRY_MS, 15 * 60_000);
  assert.equal(MONITORING_MAX_RETRY_MS, 2 * 60 * 60_000);
  assert.equal(MONITORING_MAX_FAILURE_ATTEMPTS, 5);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(monitoringFailureRetryDelayMs),
    [15, 30, 60, 120, 120].map((minutes) => minutes * 60_000)
  );
  assert.equal(nextMonitoringFailureRetryAt(1, failedAt).toISOString(), "2026-07-12T12:15:00.000Z");

  const storage = await readFile(new URL("../lib/monitoring/storage.ts", import.meta.url), "utf8");
  assert.match(storage, /fail_monitoring_profile_run/);
  assert.match(storage, /deadLetteredAt/);
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

test("customer monitoring setup is one rollback-safe production RPC", async () => {
  const [migration, repository, route] = await Promise.all([
    readFile(new URL("../db/monitoring-setup-transaction.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/dashboard/repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/searches/route.ts", import.meta.url), "utf8")
  ]);
  const createFunction = repository.slice(
    repository.indexOf("export async function createMonitoredSearchFromScan"),
    repository.indexOf("async function requireOwnedSavedSearch")
  );

  assert.match(migration, /create or replace function create_customer_monitored_search/);
  assert.match(migration, /security definer/);
  assert.match(migration, /from customer_accounts account[\s\S]*for update/);
  assert.match(migration, /return jsonb_build_object\('error_code', 'PLAN_REQUIRED'\)/);
  assert.match(migration, /return jsonb_build_object\('error_code', 'LIMIT_REACHED'\)/);
  assert.match(migration, /return jsonb_build_object\('error_code', 'REPORT_NOT_ELIGIBLE'\)/);
  assert.match(migration, /insert into customer_saved_searches/);
  assert.match(migration, /insert into customer_saved_search_versions/);
  assert.match(migration, /insert into monitored_profiles/);
  assert.match(migration, /insert into customer_scan_saved_search_versions/);
  assert.match(migration, /insert into customer_monitored_profile_ownership/);
  assert.match(migration, /insert into customer_monitored_profile_saved_search_versions/);
  assert.doesNotMatch(migration, /exception\s+when/i);

  assert.match(createFunction, /supabaseRpc<MonitoringSetupRpcResult>\("create_customer_monitored_search"/);
  assert.doesNotMatch(createFunction, /dashboardInsert|dashboardUpdate|Promise\.all/);
  assert.match(route, /error\.code === "PLAN_REQUIRED"/);
  assert.match(route, /searchErrorCode: error\.code/);
  assert.match(route, /TEMPORARY_SETUP_FAILURE/);
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
  assert.match(route, /DEFAULT_PROFILE_BATCH_SIZE = 5/);
  assert.match(route, /MAX_PROFILE_BATCH_SIZE = 10/);
  assert.match(route, /DEFAULT_PROFILE_CONCURRENCY = 3/);
  assert.match(route, /MAX_PROFILE_CONCURRENCY = 5/);
  assert.match(route, /process\.env\.MONITORING_PROFILE_BATCH_SIZE/);
  assert.match(route, /process\.env\.MONITORING_PROFILE_CONCURRENCY/);
  assert.match(route, /claimDueMonitoredProfiles\(profileBatchSize\(\)\)/);
  assert.match(route, /processClaimedProfiles\(profiles, startedAt\)/);
  assert.match(route, /releaseMonitoringProfileClaim/);
  assert.match(route, /claimPendingMonitoringAlerts\(5\)/);
  assert.match(route, /executeScanPipeline\(scan\.id, input, \{/);
  assert.match(route, /findNewMonitoringSignals/);
  assert.match(route, /getMonitoringQueueHealth/);
  assert.match(route, /event: "cron\.monitoring\.summary"/);
  assert.match(route, /const configurationFailed = !emailConfig \|\| !deadlineEmailConfig/);
  assert.match(route, /configurationFailed \|\| storageFailed \? 503 : deliveryFailed \? 502 : 500/);
  assert.match(route, /alertsDeadLettered \+= 1/);
  assert.match(route, /deadlineAlertsDeadLettered \+= 1/);
  assert.doesNotMatch(route, /claimPendingMonitoringAlerts\(5\)\.catch\(\(\) => \[\]\)/);
  assert.doesNotMatch(route, /claimPendingDeadlineAlerts\(5\)\.catch\(\(\) => \[\]\)/);
  assert.match(storage, /monitoringOpportunityKey/);
  assert.match(storage, /start_monitoring_profile_run/);
  assert.match(storage, /complete_monitoring_profile_run/);
  assert.match(storage, /fail_monitoring_profile_run/);
  assert.match(storage, /release_monitoring_profile_claim/);
  assert.match(storage, /get_monitoring_queue_health/);
  assert.match(storage, /provider_message_id/);
  assert.match(storage, /nextMonitoringRunAt/);
});

test("repeated manual runs collapse into one cooldown-protected queue request", async () => {
  const [route, repository] = await Promise.all([
    readFile(new URL("../app/api/dashboard/searches/[searchId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/dashboard/repository.ts", import.meta.url), "utf8")
  ]);
  const requestFunction = repository.slice(
    repository.indexOf("export async function requestSavedSearchRunNow"),
    repository.indexOf("async function requireAccount")
  );

  assert.doesNotMatch(route, /CRON_SECRET|\/api\/cron\/monitoring|fetch\(runUrl/);
  assert.doesNotMatch(route, /Monitoring run completed/);
  assert.match(route, /Monitoring run queued for the next scheduled check/);
  assert.match(requestFunction, /next_run_at: `gt\.\$\{requestedAt\.toISOString\(\)\}`/);
  assert.match(requestFunction, /updated_at: `lt\.\$\{cooldownCutoff\.toISOString\(\)\}`/);
  assert.match(requestFunction, /const enqueued = Boolean\(updated\)/);
  assert.doesNotMatch(requestFunction, /lease_expires_at/);

  const requestedAt = new Date("2026-07-12T12:00:00.000Z");
  const cooldownCutoff = new Date(requestedAt.getTime() - 5 * 60_000);
  const profile = {
    status: "active",
    nextRunAt: new Date("2026-07-13T12:00:00.000Z"),
    updatedAt: new Date("2026-07-12T11:00:00.000Z")
  };
  const canEnqueue = () => profile.status === "active"
    && profile.nextRunAt > requestedAt
    && profile.updatedAt < cooldownCutoff;

  assert.equal(canEnqueue(), true);
  profile.nextRunAt = requestedAt;
  profile.updatedAt = requestedAt;
  assert.equal(canEnqueue(), false, "the same profile cannot be enqueued twice during cooldown");
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
  assert.ok(request.init.signal instanceof AbortSignal);
  assert.equal(request.init.headers["Idempotency-Key"], "monitoring-alert/alert-123");
  assert.deepEqual(request.body.to, ["customer@example.test"]);
  assert.match(request.body.subject, /City arts grant/);
  assert.match(request.body.text, /https:\/\/scanner\.example\.test\/reports\/scan-123/);
  assert.equal(monitoringReportUrl(config, "scan/123"), "https://scanner.example.test/reports/scan%2F123");
});

test("hung Resend delivery aborts within the bounded timeout", async () => {
  const config = {
    apiKey: "re_test",
    fromEmail: "alerts@example.test",
    appUrl: "https://scanner.example.test"
  };
  const alert = {
    alert_id: "alert-timeout",
    monitoring_run_id: "run-timeout",
    customer_account_id: "account-timeout",
    scan_id: "scan-timeout",
    recipient_email: "customer@example.test",
    opportunity_title: "Hung delivery test",
    attempt_count: 1
  };
  let observedAbort = false;
  const hungFetch = async (_url, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    assert.ok(signal instanceof AbortSignal);
    const abort = () => {
      observedAbort = true;
      reject(signal.reason);
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });

  await assert.rejects(
    sendMonitoringAlertEmail(config, alert, hungFetch, { timeoutMs: 20 }),
    /Resend delivery timed out after 20ms/
  );
  assert.equal(observedAbort, true);
});

test("Resend delivery removes caller abort listeners after completion", async () => {
  const controller = new AbortController();
  const config = {
    apiKey: "re_test",
    fromEmail: "alerts@example.test",
    appUrl: "https://scanner.example.test"
  };
  const alert = {
    alert_id: "alert-cleanup",
    monitoring_run_id: "run-cleanup",
    customer_account_id: "account-cleanup",
    scan_id: "scan-cleanup",
    recipient_email: "customer@example.test",
    opportunity_title: "Listener cleanup test",
    attempt_count: 1
  };

  await sendMonitoringAlertEmail(
    config,
    alert,
    async () => Response.json({ id: "email-cleanup" }),
    { signal: controller.signal, timeoutMs: 100 }
  );

  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("monitoring env example documents delivery names without values", async () => {
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(env, /^CRON_SECRET=$/m);
  assert.match(env, /^RESEND_API_KEY=$/m);
  assert.match(env, /^RESEND_FROM_EMAIL=$/m);
});
