import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MONITORING_MAX_FAILURE_ATTEMPTS,
  monitoringFailureRetryDelayMs,
  recordMonitoringSchedulerHeartbeat
} from "../lib/monitoring/storage.ts";

const [migration, heartbeatMigration, route, storage, vercel] = await Promise.all([
  readFile(new URL("../db/monitoring-throughput-reliability.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/monitoring-scheduler-heartbeats.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/cron/monitoring/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/monitoring/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("../vercel.json", import.meta.url), "utf8").then(JSON.parse)
]);

function heartbeat(overrides = {}) {
  return {
    invocationId: "11111111-1111-4111-8111-111111111111",
    startedAt: "2026-07-15T12:00:00.000Z",
    completedAt: "2026-07-15T12:00:10.000Z",
    durationMs: 10_000,
    httpStatus: 200,
    outcome: "completed",
    profilesClaimed: 3,
    profilesCompleted: 3,
    profilesFailed: 0,
    profilesDeferred: 0,
    monitoringAlertsClaimed: 2,
    monitoringAlertsDelivered: 2,
    monitoringAlertsFailed: 0,
    monitoringAlertsRetried: 0,
    monitoringAlertsDeadLettered: 0,
    deadlineAlertsEnqueued: 1,
    deadlineAlertsClaimed: 1,
    deadlineAlertsDelivered: 1,
    deadlineAlertsFailed: 0,
    deadlineAlertsRetried: 0,
    deadlineAlertsDeadLettered: 0,
    configurationFailureCount: 0,
    storageFailureCount: 0,
    queueHealth: {
      backlog_count: 4,
      oldest_due_age_seconds: 120,
      leased_count: 0,
      stale_lease_count: 0,
      retrying_count: 1,
      dead_letter_count: 0
    },
    ...overrides
  };
}

async function captureHeartbeatPayload(input, responseStatus = 204) {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;
  let payload;
  process.env.SUPABASE_URL = "https://scheduler-evidence.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(init.body);
    return new Response(responseStatus === 204 ? null : "write failed", {
      status: responseStatus,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    await recordMonitoringSchedulerHeartbeat(input);
    return payload;
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

test("v0025 adds durable bounded retry and terminal profile state", () => {
  assert.match(migration, /failure_attempt_count integer not null default 0/);
  assert.match(migration, /check \(failure_attempt_count between 0 and 5\)/);
  assert.match(migration, /last_failure_at timestamptz/);
  assert.match(migration, /last_error text/);
  assert.match(migration, /dead_lettered_at timestamptz/);
  assert.match(migration, /monitoring_retry_delay/);
  assert.match(migration, /least\(120, 15 \* \(2 \^ greatest\(0, p_failure_attempt_count - 1\)\)/);
  assert.match(migration, /when v_attempt_count >= 5 then p_failed_at/);
  assert.match(migration, /dead_lettered_at is null/);

  assert.equal(MONITORING_MAX_FAILURE_ATTEMPTS, 5);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((attempt) => monitoringFailureRetryDelayMs(attempt) / 60_000),
    [15, 30, 60, 120, 120]
  );
  assert.ok(monitoringFailureRetryDelayMs(1) <= 30 * 60_000, "first retry must be within 30 minutes");
});

test("claims are fenced and duplicate concurrent claims are excluded", () => {
  assert.match(migration, /lease_token uuid/);
  assert.match(migration, /claim_token uuid/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /lease_token = gen_random_uuid\(\)/);
  assert.match(migration, /profile\.lease_token is null/);
  assert.match(migration, /monitoring_runs_profile_claim_unique_idx/);
  assert.match(migration, /on conflict \(monitored_profile_id, claim_token\)/);
  assert.match(migration, /run\.claim_token = p_lease_token/);
  assert.match(migration, /profile\.lease_token = p_lease_token/);
  assert.match(migration, /release_monitoring_profile_claim/);

  const profiles = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, due: true, token: null }));
  const claim = (limit, tokenPrefix) => profiles
    .filter((profile) => profile.due && profile.token === null)
    .slice(0, limit)
    .map((profile) => {
      profile.token = `${tokenPrefix}-${profile.id}`;
      return profile.id;
    });
  const firstWorker = claim(5, "worker-a");
  const secondWorker = claim(5, "worker-b");
  assert.equal(new Set([...firstWorker, ...secondWorker]).size, 8);
  assert.deepEqual(firstWorker.filter((id) => secondWorker.includes(id)), []);
});

test("expired leases recover running work and count toward the five-attempt limit", () => {
  assert.match(migration, /recover_stale_monitoring_claims/);
  assert.match(migration, /profile\.lease_expires_at <= now\(\)/);
  assert.match(migration, /Monitoring worker lease expired before completion\./);
  assert.match(migration, /run\.status = 'running'/);
  assert.match(migration, /profile\.lease_expires_at is null/);
  assert.match(migration, /run\.claim_token = stale\.lease_token or run\.claim_token is null/);
  assert.match(migration, /failure_attempt_count = least\(profile\.failure_attempt_count \+ 1, 5\)/);
  assert.match(migration, /perform public\.recover_stale_monitoring_claims/);

  const recover = (attempts) => {
    const nextAttempts = Math.min(attempts + 1, MONITORING_MAX_FAILURE_ATTEMPTS);
    return {
      attempts: nextAttempts,
      deadLettered: nextAttempts >= MONITORING_MAX_FAILURE_ATTEMPTS,
      retryMinutes: nextAttempts >= MONITORING_MAX_FAILURE_ATTEMPTS
        ? null
        : monitoringFailureRetryDelayMs(nextAttempts) / 60_000
    };
  };
  assert.deepEqual(recover(0), { attempts: 1, deadLettered: false, retryMinutes: 15 });
  assert.deepEqual(recover(4), { attempts: 5, deadLettered: true, retryMinutes: null });
});

test("queue health is aggregate, bounded, and contains the launch operations signals", () => {
  for (const field of [
    "backlog_count",
    "oldest_due_at",
    "oldest_due_age_seconds",
    "leased_count",
    "stale_lease_count",
    "retrying_count",
    "dead_letter_count",
    "last_success_at"
  ]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /create or replace function public\.get_monitoring_queue_health\(\)/);
  assert.match(migration, /grant execute on function public\.get_monitoring_queue_health\(\) to service_role/);
  assert.doesNotMatch(migration.slice(migration.indexOf("get_monitoring_queue_health")), /recipient_email|customer\.email/);
  assert.match(route, /health: MonitoringQueueHealth \| null/);
  assert.match(route, /queueHealth = await getMonitoringQueueHealth\(\)/);
});

test("batch architecture can clear 150 profiles per day when invoked every 15 minutes", () => {
  const defaultBatch = Number(route.match(/DEFAULT_PROFILE_BATCH_SIZE = (\d+)/)?.[1]);
  const defaultConcurrency = Number(route.match(/DEFAULT_PROFILE_CONCURRENCY = (\d+)/)?.[1]);
  const invocationsPerDay = 24 * 4;
  assert.ok(defaultBatch * invocationsPerDay >= 150);
  assert.ok(defaultConcurrency * invocationsPerDay >= 150);
  assert.match(route, /MAX_PROFILE_BATCH_SIZE = 10/);
  assert.match(route, /MONITORING_PROFILE_BATCH_SIZE/);
  assert.match(route, /MONITORING_PROFILE_CONCURRENCY/);
  assert.match(route, /MINIMUM_PROFILE_START_BUDGET_MS/);
  assert.match(route, /status: "deferred"/);
  assert.match(route, /Production throughput requires a frequent authorized invocation/);

  assert.deepEqual(
    vercel.crons.find((job) => job.path === "/api/cron/monitoring"),
    { path: "/api/cron/monitoring", schedule: "*/15 * * * *" }
  );
});

test("all reliability RPCs remain private to the service role", () => {
  for (const functionName of [
    "recover_stale_monitoring_claims",
    "claim_due_monitored_profiles",
    "claim_monitored_profile_by_id",
    "start_monitoring_profile_run",
    "complete_monitoring_profile_run",
    "fail_monitoring_profile_run",
    "release_monitoring_profile_claim",
    "get_monitoring_queue_health"
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated`)
    );
  }
});

test("v0028 stores only aggregate scheduler evidence with bounded retention", () => {
  const tableDefinition = heartbeatMigration.slice(
    heartbeatMigration.indexOf("create table if not exists public.monitoring_scheduler_runs"),
    heartbeatMigration.indexOf("comment on table public.monitoring_scheduler_runs")
  );

  assert.match(heartbeatMigration, /create table if not exists public\.monitoring_scheduler_runs/);
  assert.match(heartbeatMigration, /on conflict \(invocation_id\) do update/);
  assert.match(heartbeatMigration, /where started_at < now\(\) - interval '90 days'/);
  assert.match(heartbeatMigration, /p_since timestamptz default now\(\) - interval '48 hours'/);
  assert.match(heartbeatMigration, /greatest\(p_since, now\(\) - interval '90 days'\)/);
  assert.match(heartbeatMigration, /interval_since_previous_seconds/);
  assert.match(heartbeatMigration, /completed_profiles_per_minute/);
  assert.match(heartbeatMigration, /p_limit < 1 or p_limit > 1000/);
  assert.doesNotMatch(
    tableDefinition,
    /monitored_profile_id|profile_id|scan_id|customer|company|email|recipient|user_data/i
  );
});

test("scheduler heartbeat RPCs and table are service-role only", () => {
  assert.match(
    heartbeatMigration,
    /revoke all on table public\.monitoring_scheduler_runs[\s\S]*?from public, anon, authenticated, service_role/
  );
  for (const functionName of [
    "record_monitoring_scheduler_run",
    "get_monitoring_scheduler_evidence"
  ]) {
    assert.match(
      heartbeatMigration,
      new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]*?from public, anon, authenticated, service_role`)
    );
    assert.match(
      heartbeatMigration,
      new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role`)
    );
  }
  assert.match(storage, /get_monitoring_scheduler_evidence/);
});

test("successful scheduler work records aggregate timing, counts, and queue capacity", async () => {
  const payload = await captureHeartbeatPayload(heartbeat());
  assert.equal(payload.p_outcome, "completed");
  assert.equal(payload.p_profiles_claimed, 3);
  assert.equal(payload.p_profiles_completed, 3);
  assert.equal(payload.p_queue_backlog_count, 4);
  assert.equal(payload.p_queue_oldest_due_age_seconds, 120);
  assert.equal(payload.p_queue_health_available, true);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /profileId|profile_id|scanId|scan_id|company|email|recipient/i
  );
});

test("void heartbeat RPC accepts PostgREST 204 No Content", async () => {
  await assert.doesNotReject(captureHeartbeatPayload(heartbeat(), 204));
  assert.match(storage, /supabaseRpcVoid\("record_monitoring_scheduler_run"/);
});

test("authorized zero-work scheduler runs still record a durable heartbeat", async () => {
  const payload = await captureHeartbeatPayload(heartbeat({
    durationMs: 25,
    completedAt: "2026-07-15T12:00:00.025Z",
    profilesClaimed: 0,
    profilesCompleted: 0,
    monitoringAlertsClaimed: 0,
    monitoringAlertsDelivered: 0,
    deadlineAlertsEnqueued: 0,
    deadlineAlertsClaimed: 0,
    deadlineAlertsDelivered: 0,
    queueHealth: null
  }));
  assert.equal(payload.p_profiles_claimed, 0);
  assert.equal(payload.p_profiles_completed, 0);
  assert.equal(payload.p_profiles_failed, 0);
  assert.equal(payload.p_profiles_deferred, 0);
  assert.equal(payload.p_queue_health_available, false);
  assert.equal(payload.p_queue_backlog_count, null);
});

test("heartbeat recording failure cannot repeat monitoring work", async () => {
  await assert.rejects(
    captureHeartbeatPayload(heartbeat(), 500),
    /Supabase RPC failed: write failed/
  );

  const responder = route.slice(
    route.indexOf("async function respondWithSummary"),
    route.indexOf("function authorized")
  );
  assert.equal(
    (responder.match(/recordMonitoringSchedulerHeartbeat\(/g) ?? []).length,
    1,
    "the finalizer attempts one heartbeat write"
  );
  assert.match(responder, /catch \(cause\)[\s\S]*?return Response\.json\(summary, \{ status \}\)/);
  assert.doesNotMatch(
    responder,
    /claimDueMonitoredProfiles|claimMonitoredProfileById|processClaimedProfiles|processMonitoredProfile/,
    "heartbeat failure must not re-enter claim or processing work"
  );
  assert.match(storage, /withSupabaseRequestBudget\(\{ timeoutMs: 3_000 \}/);
});
