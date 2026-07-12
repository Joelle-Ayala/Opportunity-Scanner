import { supabaseRpc } from "../supabaseRest";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export type EnqueueScanNurtureInput = {
  scanId: string;
  email: string;
  recipientName?: string | null;
  companyName?: string | null;
};

export type ScanNurtureEnrollmentResult = {
  enrollment_id: string;
  subscriber_id: string;
  subscriber_status: "subscribed" | "unsubscribed";
  queued_count: number;
};

export type ClaimedNurtureJob = {
  job_id: string;
  enrollment_id: string;
  subscriber_id: string;
  scan_id: string;
  recipient_email: string;
  recipient_name?: string | null;
  company_name?: string | null;
  touch_number: 1 | 2 | 3 | 4 | 5;
  attempt_count: number;
};

export async function enqueueScanNurture(
  input: EnqueueScanNurtureInput
): Promise<ScanNurtureEnrollmentResult> {
  const email = input.email.trim();
  if (!UUID_PATTERN.test(input.scanId) || !EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error("A valid scan ID and recipient email are required for nurture enrollment.");
  }

  const rows = await supabaseRpc<ScanNurtureEnrollmentResult[]>("enqueue_scan_nurture", {
    p_scan_id: input.scanId,
    p_email: email,
    p_recipient_name: input.recipientName?.trim().slice(0, 120) || null,
    p_company_name: input.companyName?.trim().slice(0, 160) || null
  });
  const result = rows[0];
  if (!result) throw new Error("Scan nurture enrollment did not return a result.");
  return result;
}

export async function claimDueNurtureJobs(limit = 10): Promise<ClaimedNurtureJob[]> {
  return supabaseRpc<ClaimedNurtureJob[]>("claim_due_scan_nurture_jobs", { p_limit: limit });
}

export async function completeNurtureJob(jobId: string, providerMessageId: string): Promise<boolean> {
  return supabaseRpc<boolean>("complete_scan_nurture_job", {
    p_job_id: jobId,
    p_provider_message_id: providerMessageId
  });
}

export async function releaseNurtureJob(jobId: string, cause: unknown): Promise<string | null> {
  const message = cause instanceof Error ? cause.message : "Nurture delivery failed.";
  return supabaseRpc<string | null>("release_scan_nurture_job", {
    p_job_id: jobId,
    p_error: message.trim().slice(0, 500) || "Nurture delivery failed."
  });
}

export async function unsubscribeScanNurture(subscriberId: string): Promise<boolean> {
  return supabaseRpc<boolean>("unsubscribe_scan_nurture", { p_subscriber_id: subscriberId });
}
