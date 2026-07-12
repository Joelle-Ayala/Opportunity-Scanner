import { supabaseRpc, supabaseUpdate } from "../supabaseRest";

export type ClaimedDeadlineAlert = {
  alert_id: string;
  customer_account_id: string;
  scan_id: string;
  recipient_email: string;
  opportunity_title: string;
  agency_or_funder?: string | null;
  deadline_date: string;
  reminder_days: number;
  attempt_count: number;
};

export async function enqueueDueDeadlineAlerts(limit = 100): Promise<number> {
  return supabaseRpc<number>("enqueue_due_deadline_alerts", { p_limit: limit });
}

export async function claimPendingDeadlineAlerts(limit = 5): Promise<ClaimedDeadlineAlert[]> {
  return supabaseRpc<ClaimedDeadlineAlert[]>("claim_pending_deadline_alerts", { p_limit: limit });
}

export async function markDeadlineAlertSent(
  alertId: string,
  providerMessageId: string,
  deliveredAt = new Date()
): Promise<void> {
  await supabaseUpdate("deadline_alerts", alertId, {
    delivery_status: "sent",
    delivered_at: deliveredAt.toISOString(),
    provider_message_id: providerMessageId,
    delivery_lease_expires_at: null,
    next_attempt_at: null,
    last_error: null
  });
}

export async function releaseDeadlineAlert(
  alert: ClaimedDeadlineAlert,
  cause: unknown,
  failedAt = new Date()
): Promise<void> {
  const terminal = alert.attempt_count >= 5;
  const retryDelayMinutes = Math.min(15 * 2 ** Math.max(0, alert.attempt_count - 1), 24 * 60);
  const message = cause instanceof Error ? cause.message : "Deadline alert delivery failed.";
  await supabaseUpdate("deadline_alerts", alert.alert_id, {
    delivery_status: terminal ? "failed" : "pending",
    delivery_lease_expires_at: null,
    next_attempt_at: terminal
      ? null
      : new Date(failedAt.getTime() + retryDelayMinutes * 60_000).toISOString(),
    last_error: message.trim().slice(0, 500) || "Deadline alert delivery failed."
  });
}

