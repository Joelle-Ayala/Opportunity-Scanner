import type { MonitoringSchedulerEvidence } from "./storage.ts";

const MINIMUM_RUNS = 180;
const MINIMUM_WINDOW_SECONDS = 47 * 60 * 60;
const MINIMUM_INTERVAL_SECONDS = 10 * 60;
const MAXIMUM_INTERVAL_SECONDS = 20 * 60;
const MAXIMUM_DURATION_MS = 60_000;
const MAXIMUM_OLDEST_DUE_AGE_SECONDS = 30 * 60;

function maximum(values: Array<number | null | undefined>): number {
  return Math.max(0, ...values.filter((value): value is number => Number.isFinite(value)));
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

export type MonitoringSoakReadiness = {
  ready: boolean;
  blockers: string[];
  evidence: {
    runs: number;
    windowSeconds: number;
    cadenceSamples: number;
    cadenceViolations: number;
    maximumIntervalSeconds: number;
    maximumDurationMs: number;
    profilesClaimed: number;
    profilesCompleted: number;
    profilesFailed: number;
    deliveryFailures: number;
    deadLetters: number;
    configurationFailures: number;
    storageFailures: number;
    maximumBacklog: number;
    maximumOldestDueAgeSeconds: number;
  };
};

export function evaluateMonitoringSoakReadiness(
  rows: MonitoringSchedulerEvidence[]
): MonitoringSoakReadiness {
  const ordered = [...rows].sort(
    (left, right) => new Date(left.started_at).getTime() - new Date(right.started_at).getTime()
  );
  const intervals = ordered
    .map((row) => row.interval_since_previous_seconds)
    .filter((value): value is number => Number.isFinite(value));
  const cadenceViolations = intervals.filter(
    (seconds) => seconds < MINIMUM_INTERVAL_SECONDS || seconds > MAXIMUM_INTERVAL_SECONDS
  ).length;
  const windowSeconds = ordered.length < 2
    ? 0
    : Math.max(
        0,
        Math.floor(
          (new Date(ordered.at(-1)!.started_at).getTime() - new Date(ordered[0]!.started_at).getTime()) / 1000
        )
      );
  const profilesClaimed = sum(ordered.map((row) => row.profiles_claimed));
  const profilesCompleted = sum(ordered.map((row) => row.profiles_completed));
  const profilesFailed = sum(ordered.map((row) => row.profiles_failed));
  const deliveryFailures = sum(ordered.map((row) =>
    row.monitoring_alerts_failed + row.deadline_alerts_failed
  ));
  const deadLetters = sum(ordered.map((row) =>
    row.monitoring_alerts_dead_lettered
      + row.deadline_alerts_dead_lettered
      + (row.queue_dead_letter_count ?? 0)
  ));
  const configurationFailures = sum(ordered.map((row) => row.configuration_failure_count));
  const storageFailures = sum(ordered.map((row) => row.storage_failure_count));
  const unsuccessfulRuns = ordered.filter(
    (row) => row.http_status !== 200 || row.outcome !== "completed"
  ).length;
  const staleLeases = maximum(ordered.map((row) => row.queue_stale_lease_count));
  const maximumDurationMs = maximum(ordered.map((row) => row.duration_ms));
  const maximumOldestDueAgeSeconds = maximum(ordered.map((row) => row.queue_oldest_due_age_seconds));
  const blockers: string[] = [];

  if (ordered.length < MINIMUM_RUNS) blockers.push(`Need at least ${MINIMUM_RUNS} scheduler runs.`);
  if (windowSeconds < MINIMUM_WINDOW_SECONDS) blockers.push("Need at least 47 hours of scheduler evidence.");
  if (cadenceViolations > 0) blockers.push("Scheduler cadence left the 10-20 minute operating window.");
  if (unsuccessfulRuns > 0) blockers.push("Every scheduler invocation must complete with HTTP 200.");
  if (maximumDurationMs >= MAXIMUM_DURATION_MS) blockers.push("A scheduler invocation reached the 60-second runtime limit.");
  if (profilesClaimed === 0) blockers.push("The soak must process at least one internal monitored profile.");
  if (profilesFailed > 0) blockers.push("The soak contains failed monitored-profile runs.");
  if (deliveryFailures > 0) blockers.push("The soak contains failed customer-alert deliveries.");
  if (deadLetters > 0) blockers.push("The soak contains dead-lettered work.");
  if (configurationFailures > 0) blockers.push("The soak contains monitoring configuration failures.");
  if (storageFailures > 0) blockers.push("The soak contains monitoring storage failures.");
  if (staleLeases > 0) blockers.push("The soak contains stale monitoring leases.");
  if (maximumOldestDueAgeSeconds > MAXIMUM_OLDEST_DUE_AGE_SECONDS) {
    blockers.push("Monitoring backlog age exceeded 30 minutes.");
  }

  return {
    ready: blockers.length === 0,
    blockers,
    evidence: {
      runs: ordered.length,
      windowSeconds,
      cadenceSamples: intervals.length,
      cadenceViolations,
      maximumIntervalSeconds: maximum(intervals),
      maximumDurationMs,
      profilesClaimed,
      profilesCompleted,
      profilesFailed,
      deliveryFailures,
      deadLetters,
      configurationFailures,
      storageFailures,
      maximumBacklog: maximum(ordered.map((row) => row.queue_backlog_count)),
      maximumOldestDueAgeSeconds
    }
  };
}
