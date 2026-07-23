import {
  supabaseRpc,
  supabaseRpcVoid,
  supabaseUpdate,
  withSupabaseRequestBudget
} from "../supabaseRest.ts";
import type { StoredOpportunitySignal } from "../types.ts";
import {
  monitoringOpportunityKey,
  nextMonitoringRunAt,
  type MonitoringCadence
} from "./core.ts";

export const MONITORING_MAX_FAILURE_ATTEMPTS = 5;
export const MONITORING_INITIAL_RETRY_MS = 15 * 60_000;
export const MONITORING_MAX_RETRY_MS = 2 * 60 * 60_000;

export function monitoringFailureRetryDelayMs(attemptCount: number): number {
  const normalizedAttempt = Math.max(1, Math.min(Math.floor(attemptCount), MONITORING_MAX_FAILURE_ATTEMPTS));
  return Math.min(
    MONITORING_INITIAL_RETRY_MS * 2 ** (normalizedAttempt - 1),
    MONITORING_MAX_RETRY_MS
  );
}

export function nextMonitoringFailureRetryAt(attemptCount: number, failedAt = new Date()): Date {
  return new Date(failedAt.getTime() + monitoringFailureRetryDelayMs(attemptCount));
}

export type MonitoredProfileRecord = {
  id: string;
  stripe_customer_id: string;
  source_scan_id: string;
  latest_scan_id?: string | null;
  cadence: MonitoringCadence;
  status: "active" | "paused" | "canceled";
  next_run_at: string;
  last_run_at?: string | null;
  lease_expires_at?: string | null;
  lease_token?: string | null;
  failure_attempt_count: number;
  last_failure_at?: string | null;
  last_error?: string | null;
  dead_lettered_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type MonitoringRunRecord = {
  id: string;
  monitored_profile_id: string;
  scan_id: string;
  status: "running" | "completed" | "failed";
  new_opportunity_count: number;
  error_message?: string | null;
  claim_token?: string | null;
  started_at: string;
  completed_at?: string | null;
};

export type MonitoringQueueHealth = {
  backlog_count: number;
  oldest_due_at?: string | null;
  oldest_due_age_seconds?: number | null;
  leased_count: number;
  stale_lease_count: number;
  retrying_count: number;
  dead_letter_count: number;
  last_success_at?: string | null;
};

export type MonitoringSchedulerOutcome =
  | "completed"
  | "configuration_error"
  | "storage_error"
  | "delivery_failed"
  | "run_failed";

export type MonitoringSchedulerHeartbeat = {
  invocationId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  httpStatus: number;
  outcome: MonitoringSchedulerOutcome;
  profilesClaimed: number;
  profilesCompleted: number;
  profilesFailed: number;
  profilesDeferred: number;
  monitoringAlertsClaimed: number;
  monitoringAlertsDelivered: number;
  monitoringAlertsFailed: number;
  monitoringAlertsRetried: number;
  monitoringAlertsDeadLettered: number;
  deadlineAlertsEnqueued: number;
  deadlineAlertsClaimed: number;
  deadlineAlertsDelivered: number;
  deadlineAlertsFailed: number;
  deadlineAlertsRetried: number;
  deadlineAlertsDeadLettered: number;
  configurationFailureCount: number;
  storageFailureCount: number;
  queueHealth: MonitoringQueueHealth | null;
};

export type MonitoringSchedulerEvidence = {
  invocation_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  interval_since_previous_seconds?: number | null;
  http_status: number;
  outcome: MonitoringSchedulerOutcome;
  profiles_claimed: number;
  profiles_completed: number;
  profiles_failed: number;
  profiles_deferred: number;
  completed_profiles_per_minute?: number | null;
  monitoring_alerts_claimed: number;
  monitoring_alerts_delivered: number;
  monitoring_alerts_failed: number;
  monitoring_alerts_retried: number;
  monitoring_alerts_dead_lettered: number;
  deadline_alerts_enqueued: number;
  deadline_alerts_claimed: number;
  deadline_alerts_delivered: number;
  deadline_alerts_failed: number;
  deadline_alerts_retried: number;
  deadline_alerts_dead_lettered: number;
  configuration_failure_count: number;
  storage_failure_count: number;
  queue_health_available: boolean;
  queue_backlog_count?: number | null;
  queue_oldest_due_age_seconds?: number | null;
  queue_leased_count?: number | null;
  queue_stale_lease_count?: number | null;
  queue_retrying_count?: number | null;
  queue_dead_letter_count?: number | null;
  recorded_at: string;
};

type MonitoringFailureResult = {
  finalized: boolean;
  attemptCount?: number;
  nextRunAt?: string | null;
  deadLetteredAt?: string | null;
};

export type ClaimedMonitoringAlert = {
  alert_id: string;
  monitoring_run_id: string;
  customer_account_id: string;
  scan_id: string;
  recipient_email: string;
  opportunity_title: string;
  agency_or_funder?: string | null;
  deadline?: string | null;
  attempt_count: number;
};

export async function claimDueMonitoredProfiles(limit = 1): Promise<MonitoredProfileRecord[]> {
  return supabaseRpc<MonitoredProfileRecord[]>("claim_due_monitored_profiles", {
    p_limit: limit
  });
}

export async function claimMonitoredProfileById(profileId: string): Promise<MonitoredProfileRecord[]> {
  return supabaseRpc<MonitoredProfileRecord[]>("claim_monitored_profile_by_id", {
    p_profile_id: profileId
  });
}

export async function startMonitoringRun(
  monitoredProfileId: string,
  scanId: string,
  leaseToken: string
): Promise<MonitoringRunRecord> {
  const runs = await supabaseRpc<MonitoringRunRecord[]>("start_monitoring_profile_run", {
    p_profile_id: monitoredProfileId,
    p_scan_id: scanId,
    p_lease_token: leaseToken
  });
  const run = runs[0];
  if (!run) throw new Error("The monitoring claim expired before the run could start.");
  return run;
}

export async function completeMonitoringRun(input: {
  profile: MonitoredProfileRecord;
  run: MonitoringRunRecord;
  scanId: string;
  newSignals: StoredOpportunitySignal[];
  completedAt?: Date;
}): Promise<void> {
  const completedAt = input.completedAt ?? new Date();
  const leaseToken = input.profile.lease_token;
  if (!leaseToken) throw new Error("The monitoring claim has no lease token.");

  const finalized = await supabaseRpc<boolean>("complete_monitoring_profile_run", {
    p_profile_id: input.profile.id,
    p_run_id: input.run.id,
    p_scan_id: input.scanId,
    p_lease_token: leaseToken,
    p_new_opportunity_count: input.newSignals.length,
    p_alerts: input.newSignals.map((signal) => ({
      opportunity_id: signal.id,
      dedupe_key: monitoringOpportunityKey(signal)
    })),
    p_completed_at: completedAt.toISOString()
  });
  if (!finalized) throw new Error("The monitoring lease expired before completion could be saved.");

  console.info("monitoring.run_summary", {
    profileId: input.profile.id,
    runId: input.run.id,
    status: "completed",
    newOpportunityCount: input.newSignals.length,
    completedAt: completedAt.toISOString(),
    nextRunAt: nextMonitoringRunAt(input.profile.cadence, completedAt).toISOString()
  });
}

export async function claimPendingMonitoringAlerts(limit = 5): Promise<ClaimedMonitoringAlert[]> {
  return supabaseRpc<ClaimedMonitoringAlert[]>("claim_pending_monitoring_alerts", {
    p_limit: limit
  });
}

export async function markMonitoringAlertSent(
  alertId: string,
  providerMessageId: string,
  deliveredAt = new Date()
): Promise<void> {
  await supabaseUpdate("monitoring_alerts", alertId, {
    delivery_status: "sent",
    delivered_at: deliveredAt.toISOString(),
    provider_message_id: providerMessageId,
    delivery_lease_expires_at: null,
    next_attempt_at: null,
    last_error: null
  });
}

export async function releaseMonitoringAlert(
  alert: ClaimedMonitoringAlert,
  cause: unknown,
  failedAt = new Date()
): Promise<void> {
  const terminal = alert.attempt_count >= 5;
  const retryDelayMinutes = Math.min(15 * 2 ** Math.max(0, alert.attempt_count - 1), 24 * 60);
  const message = cause instanceof Error ? cause.message : "Alert delivery failed.";

  await supabaseUpdate("monitoring_alerts", alert.alert_id, {
    delivery_status: terminal ? "failed" : "pending",
    delivery_lease_expires_at: null,
    next_attempt_at: terminal
      ? null
      : new Date(failedAt.getTime() + retryDelayMinutes * 60_000).toISOString(),
    last_error: message.trim().slice(0, 500) || "Alert delivery failed."
  });
}

export async function failMonitoringRun(input: {
  profile: MonitoredProfileRecord;
  run?: MonitoringRunRecord | null;
  message: string;
  failedAt?: Date;
}): Promise<MonitoringFailureResult> {
  const failedAt = input.failedAt ?? new Date();
  const message = input.message.trim().slice(0, 500) || "Monitoring run failed.";
  const leaseToken = input.profile.lease_token;
  if (!leaseToken) return { finalized: false };

  const result = await supabaseRpc<MonitoringFailureResult>("fail_monitoring_profile_run", {
    p_profile_id: input.profile.id,
    p_run_id: input.run?.id ?? null,
    p_lease_token: leaseToken,
    p_error_message: message,
    p_failed_at: failedAt.toISOString()
  });

  console.info("monitoring.run_summary", {
    profileId: input.profile.id,
    runId: input.run?.id ?? null,
    status: "failed",
    failedAt: failedAt.toISOString(),
    finalized: result.finalized,
    attemptCount: result.attemptCount ?? null,
    retryAt: result.nextRunAt ?? null,
    deadLetteredAt: result.deadLetteredAt ?? null,
    error: message
  });

  return result;
}

export async function releaseMonitoringProfileClaim(profile: MonitoredProfileRecord): Promise<boolean> {
  if (!profile.lease_token) return false;
  return supabaseRpc<boolean>("release_monitoring_profile_claim", {
    p_profile_id: profile.id,
    p_lease_token: profile.lease_token
  });
}

export async function getMonitoringQueueHealth(): Promise<MonitoringQueueHealth> {
  const rows = await supabaseRpc<MonitoringQueueHealth[]>("get_monitoring_queue_health", {});
  const health = rows[0];
  if (!health) throw new Error("Monitoring queue health was unavailable.");
  return health;
}

export async function recordMonitoringSchedulerHeartbeat(
  heartbeat: MonitoringSchedulerHeartbeat
): Promise<void> {
  const queueHealth = heartbeat.queueHealth;
  await withSupabaseRequestBudget({ timeoutMs: 3_000 }, () =>
    supabaseRpcVoid("record_monitoring_scheduler_run", {
      p_invocation_id: heartbeat.invocationId,
      p_started_at: heartbeat.startedAt,
      p_completed_at: heartbeat.completedAt,
      p_duration_ms: heartbeat.durationMs,
      p_http_status: heartbeat.httpStatus,
      p_outcome: heartbeat.outcome,
      p_profiles_claimed: heartbeat.profilesClaimed,
      p_profiles_completed: heartbeat.profilesCompleted,
      p_profiles_failed: heartbeat.profilesFailed,
      p_profiles_deferred: heartbeat.profilesDeferred,
      p_monitoring_alerts_claimed: heartbeat.monitoringAlertsClaimed,
      p_monitoring_alerts_delivered: heartbeat.monitoringAlertsDelivered,
      p_monitoring_alerts_failed: heartbeat.monitoringAlertsFailed,
      p_monitoring_alerts_retried: heartbeat.monitoringAlertsRetried,
      p_monitoring_alerts_dead_lettered: heartbeat.monitoringAlertsDeadLettered,
      p_deadline_alerts_enqueued: heartbeat.deadlineAlertsEnqueued,
      p_deadline_alerts_claimed: heartbeat.deadlineAlertsClaimed,
      p_deadline_alerts_delivered: heartbeat.deadlineAlertsDelivered,
      p_deadline_alerts_failed: heartbeat.deadlineAlertsFailed,
      p_deadline_alerts_retried: heartbeat.deadlineAlertsRetried,
      p_deadline_alerts_dead_lettered: heartbeat.deadlineAlertsDeadLettered,
      p_configuration_failure_count: heartbeat.configurationFailureCount,
      p_storage_failure_count: heartbeat.storageFailureCount,
      p_queue_health_available: Boolean(queueHealth),
      p_queue_backlog_count: queueHealth?.backlog_count ?? null,
      p_queue_oldest_due_age_seconds: queueHealth?.oldest_due_age_seconds ?? null,
      p_queue_leased_count: queueHealth?.leased_count ?? null,
      p_queue_stale_lease_count: queueHealth?.stale_lease_count ?? null,
      p_queue_retrying_count: queueHealth?.retrying_count ?? null,
      p_queue_dead_letter_count: queueHealth?.dead_letter_count ?? null
    })
  );
}

export async function getMonitoringSchedulerEvidence(
  since = new Date(Date.now() - 48 * 60 * 60_000),
  limit = 500
): Promise<MonitoringSchedulerEvidence[]> {
  return supabaseRpc<MonitoringSchedulerEvidence[]>("get_monitoring_scheduler_evidence", {
    p_since: since.toISOString(),
    p_limit: limit
  });
}
