import assert from "node:assert/strict";
import { evaluateMonitoringSoakReadiness } from "../lib/monitoring/soakReadiness.ts";

const start = new Date("2026-07-20T00:00:00.000Z");

function healthyRow(index, overrides = {}) {
  const startedAt = new Date(start.getTime() + index * 15 * 60_000);
  return {
    invocation_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    started_at: startedAt.toISOString(),
    completed_at: new Date(startedAt.getTime() + 1_000).toISOString(),
    duration_ms: 1_000,
    interval_since_previous_seconds: index === 0 ? null : 900,
    http_status: 200,
    outcome: "completed",
    profiles_claimed: index === 10 ? 1 : 0,
    profiles_completed: index === 10 ? 1 : 0,
    profiles_failed: 0,
    profiles_deferred: 0,
    monitoring_alerts_claimed: 0,
    monitoring_alerts_delivered: 0,
    monitoring_alerts_failed: 0,
    monitoring_alerts_retried: 0,
    monitoring_alerts_dead_lettered: 0,
    deadline_alerts_enqueued: 0,
    deadline_alerts_claimed: 0,
    deadline_alerts_delivered: 0,
    deadline_alerts_failed: 0,
    deadline_alerts_retried: 0,
    deadline_alerts_dead_lettered: 0,
    configuration_failure_count: 0,
    storage_failure_count: 0,
    queue_health_available: true,
    queue_backlog_count: 0,
    queue_oldest_due_age_seconds: 0,
    queue_leased_count: 0,
    queue_stale_lease_count: 0,
    queue_retrying_count: 0,
    queue_dead_letter_count: 0,
    recorded_at: startedAt.toISOString(),
    ...overrides
  };
}

const healthy = Array.from({ length: 193 }, (_, index) => healthyRow(index));
const ready = evaluateMonitoringSoakReadiness(healthy);
assert.equal(ready.ready, true);
assert.equal(ready.blockers.length, 0);
assert.equal(ready.evidence.runs, 193);
assert.equal(ready.evidence.profilesCompleted, 1);

const noWork = healthy.map((row) => ({ ...row, profiles_claimed: 0, profiles_completed: 0 }));
assert.equal(evaluateMonitoringSoakReadiness(noWork).ready, false);
assert.match(evaluateMonitoringSoakReadiness(noWork).blockers.join(" "), /internal monitored profile/);

const cadenceFailure = healthy.map((row, index) => index === 20
  ? { ...row, interval_since_previous_seconds: 1_800 }
  : row);
assert.equal(evaluateMonitoringSoakReadiness(cadenceFailure).ready, false);
assert.match(evaluateMonitoringSoakReadiness(cadenceFailure).blockers.join(" "), /cadence/);

const operationalFailure = healthy.map((row, index) => index === 30
  ? { ...row, http_status: 503, outcome: "storage_error", storage_failure_count: 1 }
  : row);
const failed = evaluateMonitoringSoakReadiness(operationalFailure);
assert.equal(failed.ready, false);
assert.match(failed.blockers.join(" "), /HTTP 200/);
assert.match(failed.blockers.join(" "), /storage failures/);

assert.equal("invocation_id" in ready.evidence, false);
assert.equal("started_at" in ready.evidence, false);
assert.equal("recorded_at" in ready.evidence, false);

console.log("Monitoring soak readiness requires 48 hours, reliable cadence, real work, and clean operations.");
