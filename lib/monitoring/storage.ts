import { supabaseRpc, supabaseUpdate } from "../supabaseRest.ts";
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
