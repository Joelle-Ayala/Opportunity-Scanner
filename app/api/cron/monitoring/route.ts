import { timingSafeEqual } from "node:crypto";
import { getDeadlineEmailConfig, sendDeadlineAlertEmail } from "@/lib/deadlineAlerts/delivery";
import {
  claimPendingDeadlineAlerts,
  enqueueDueDeadlineAlerts,
  markDeadlineAlertSent,
  releaseDeadlineAlert
} from "@/lib/deadlineAlerts/storage";
import { findNewMonitoringSignals } from "@/lib/monitoring/core";
import { getMonitoringEmailConfig, sendMonitoringAlertEmail } from "@/lib/monitoring/delivery";
import {
  claimPendingMonitoringAlerts,
  claimDueMonitoredProfiles,
  claimMonitoredProfileById,
  completeMonitoringRun,
  failMonitoringRun,
  markMonitoringAlertSent,
  releaseMonitoringAlert,
  startMonitoringRun,
  type MonitoringRunRecord
} from "@/lib/monitoring/storage";
import { executeScanPipeline } from "@/lib/scanPipeline";
import {
  createScan,
  getScan,
  listScanOpportunitySignals,
  updateScan
} from "@/lib/storage";
import type { ScanInput, ScanRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function scanInputFromRecord(scan: ScanRecord): ScanInput {
  return {
    companyUrl: scan.company_url,
    companyName: scan.company_name || undefined,
    headquartersState: scan.headquarters_state || undefined,
    targetStates: scan.target_states || undefined,
    industry: scan.industry || undefined,
    customerType: scan.customer_type as ScanInput["customerType"],
    email: scan.email || undefined,
    reportType: scan.report_type,
    opportunityFocus: scan.opportunity_focus || undefined,
    includeTerms: scan.include_terms || undefined,
    excludeTerms: scan.exclude_terms || undefined,
    prioritySignals: scan.priority_signals || []
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const emailConfig = getMonitoringEmailConfig();
  const deadlineEmailConfig = getDeadlineEmailConfig();
  let alertsDelivered = 0;
  let alertsFailed = 0;
  let deadlineAlertsEnqueued = 0;
  let deadlineAlertsDelivered = 0;
  let deadlineAlertsFailed = 0;

  let profiles;
  try {
    const requestedProfileId = new URL(request.url).searchParams.get("profileId");
    profiles = requestedProfileId && /^[0-9a-f-]{36}$/i.test(requestedProfileId)
      ? await claimMonitoredProfileById(requestedProfileId)
      : await claimDueMonitoredProfiles(1);
  } catch (cause) {
    console.error("Unable to claim due monitoring profiles", {
      error: cause instanceof Error ? cause.message : "Unknown monitoring storage error"
    });
    return Response.json(
      { ok: false, error: "Monitoring storage is unavailable." },
      { status: 503 }
    );
  }

  const results: Array<{ profileId: string; status: "completed" | "failed"; newCount?: number }> = [];

  for (const profile of profiles) {
    let scanId: string | null = null;
    let run: MonitoringRunRecord | null = null;

    try {
      const previousScanId = profile.latest_scan_id || profile.source_scan_id;
      const baselineScan = await getScan(previousScanId);
      if (!baselineScan || baselineScan.status !== "completed") {
        throw new Error("The saved profile does not have a completed baseline scan.");
      }

      const input = scanInputFromRecord(baselineScan);
      const scan = await createScan(input);
      scanId = scan.id;
      run = await startMonitoringRun(profile.id, scan.id);
      await executeScanPipeline(scan.id, input);

      const [previousSignals, currentSignals] = await Promise.all([
        listScanOpportunitySignals(previousScanId),
        listScanOpportunitySignals(scan.id)
      ]);
      const newSignals = findNewMonitoringSignals(previousSignals, currentSignals);

      await completeMonitoringRun({ profile, run, scanId: scan.id, newSignals });
      results.push({ profileId: profile.id, status: "completed", newCount: newSignals.length });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Monitoring run failed.";
      console.error("Monitoring run failed", {
        profileId: profile.id,
        scanId,
        error: message
      });
      if (scanId) {
        await updateScan(scanId, { status: "failed", error_message: message }).catch(() => undefined);
      }
      await failMonitoringRun({ profile, run, message }).catch(() => undefined);
      results.push({ profileId: profile.id, status: "failed" });
    }
  }

  try {
    deadlineAlertsEnqueued = await enqueueDueDeadlineAlerts(100);
  } catch (cause) {
    console.error("Unable to enqueue deadline alerts", {
      error: cause instanceof Error ? cause.message : "Unknown deadline alert error"
    });
    deadlineAlertsFailed += 1;
  }

  if (emailConfig) {
    const alerts = await claimPendingMonitoringAlerts(5).catch(() => []);
    for (const alert of alerts) {
      try {
        const providerMessageId = await sendMonitoringAlertEmail(emailConfig, alert);
        await markMonitoringAlertSent(alert.alert_id, providerMessageId);
        alertsDelivered += 1;
      } catch (cause) {
        console.error("Monitoring alert delivery failed", {
          alertId: alert.alert_id,
          scanId: alert.scan_id,
          error: cause instanceof Error ? cause.message : "Unknown monitoring alert error"
        });
        await releaseMonitoringAlert(alert, cause).catch(() => undefined);
        alertsFailed += 1;
      }
    }
  }

  if (deadlineEmailConfig) {
    const deadlineAlerts = await claimPendingDeadlineAlerts(5).catch(() => []);
    for (const alert of deadlineAlerts) {
      try {
        const providerMessageId = await sendDeadlineAlertEmail(deadlineEmailConfig, alert);
        await markDeadlineAlertSent(alert.alert_id, providerMessageId);
        deadlineAlertsDelivered += 1;
      } catch (cause) {
        console.error("Deadline alert delivery failed", {
          alertId: alert.alert_id,
          scanId: alert.scan_id,
          error: cause instanceof Error ? cause.message : "Unknown deadline alert error"
        });
        await releaseDeadlineAlert(alert, cause).catch(() => undefined);
        deadlineAlertsFailed += 1;
      }
    }
  }

  return Response.json({
    ok: true,
    claimed: profiles.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    delivery: {
      configured: Boolean(emailConfig),
      delivered: alertsDelivered,
      failed: alertsFailed,
      deadlines: {
        configured: Boolean(deadlineEmailConfig),
        enqueued: deadlineAlertsEnqueued,
        delivered: deadlineAlertsDelivered,
        failed: deadlineAlertsFailed
      }
    },
    results
  });
}
