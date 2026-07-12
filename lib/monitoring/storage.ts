import { supabaseInsert, supabaseRpc, supabaseUpdate } from "../supabaseRest";
import type { StoredOpportunitySignal } from "../types";
import { nextMonitoringRunAt, type MonitoringCadence } from "./core";

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

export async function claimDueMonitoredProfiles(limit = 1): Promise<MonitoredProfileRecord[]> {
  return supabaseRpc<MonitoredProfileRecord[]>("claim_due_monitored_profiles", {
    p_limit: limit
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

  for (const signal of input.newSignals) {
    await supabaseInsert("monitoring_alerts", {
      monitoring_run_id: input.run.id,
      opportunity_id: signal.id,
      alert_kind: "new_opportunity",
      delivery_status: "pending"
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
