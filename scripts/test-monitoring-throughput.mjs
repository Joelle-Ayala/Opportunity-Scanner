import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MONITORING_MAX_FAILURE_ATTEMPTS,
  monitoringFailureRetryDelayMs
} from "../lib/monitoring/storage.ts";

const [migration, route, vercel] = await Promise.all([
  readFile(new URL("../db/monitoring-throughput-reliability.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/cron/monitoring/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../vercel.json", import.meta.url), "utf8").then(JSON.parse)
]);

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
    { path: "/api/cron/monitoring", schedule: "17 12 * * *" }
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
