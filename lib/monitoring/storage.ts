import { supabaseInsert, supabaseRpc, supabaseUpdate } from "../supabaseRest";
import type { StoredOpportunitySignal } from "../types";
import {
  monitoringOpportunityKey,
  nextMonitoringRunAt,
  type MonitoringCadence
} from "./core";

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
  started_at: string;
  completed_at?: string | null;
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
  scanId: string
): Promise<MonitoringRunRecord> {
  return supabaseInsert<MonitoringRunRecord>("monitoring_runs", {
    monitored_profile_id: monitoredProfileId,
    scan_id: scanId,
    status: "running"
  });
}

export async function completeMonitoringRun(input: {
  profile: MonitoredProfileRecord;
  run: MonitoringRunRecord;
  scanId: string;
  newSignals: StoredOpportunitySignal[];
  completedAt?: Date;
}): Promise<void> {
  const completedAt = input.completedAt ?? new Date();

  if (input.newSignals.length > 0) {
    await supabaseRpc<number>("record_monitoring_alerts", {
      p_monitoring_run_id: input.run.id,
      p_monitored_profile_id: input.profile.id,
      p_alerts: input.newSignals.map((signal) => ({
        opportunity_id: signal.id,
        dedupe_key: monitoringOpportunityKey(signal)
      }))
    });
  }

  await supabaseUpdate<MonitoringRunRecord>("monitoring_runs", input.run.id, {
    status: "completed",
    new_opportunity_count: input.newSignals.length,
    completed_at: completedAt.toISOString(),
    error_message: null
  });

  await supabaseUpdate<MonitoredProfileRecord>("monitored_profiles", input.profile.id, {
    latest_scan_id: input.scanId,
    last_run_at: completedAt.toISOString(),
    next_run_at: nextMonitoringRunAt(input.profile.cadence, completedAt).toISOString(),
    lease_expires_at: null,
    updated_at: completedAt.toISOString()
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
}): Promise<void> {
  const failedAt = input.failedAt ?? new Date();
  const message = input.message.trim().slice(0, 500) || "Monitoring run failed.";

  if (input.run) {
    await supabaseUpdate<MonitoringRunRecord>("monitoring_runs", input.run.id, {
      status: "failed",
      error_message: message,
      completed_at: failedAt.toISOString()
    });
  }

  await supabaseUpdate<MonitoredProfileRecord>("monitored_profiles", input.profile.id, {
    next_run_at: nextMonitoringRunAt(input.profile.cadence, failedAt).toISOString(),
    lease_expires_at: null,
    updated_at: failedAt.toISOString()
  });
}
