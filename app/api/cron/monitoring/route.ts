import { timingSafeEqual } from "node:crypto";
import { getDeadlineEmailConfig, sendDeadlineAlertEmail } from "@/lib/deadlineAlerts/delivery";
import {
  claimPendingDeadlineAlerts,
  enqueueDueDeadlineAlerts,
  markDeadlineAlertSent,
  releaseDeadlineAlert,
  type ClaimedDeadlineAlert
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
  type ClaimedMonitoringAlert,
  type MonitoredProfileRecord,
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

const DEFAULT_PROFILE_BATCH_SIZE = 3;
const MAX_PROFILE_BATCH_SIZE = 5;

type MonitoringResult = {
  profileId: string;
  status: "completed" | "failed";
  newCount?: number;
};

type MonitoringCronSummary = {
  ok: boolean;
  outcome: "completed" | "configuration_error" | "storage_error" | "delivery_failed" | "run_failed";
  claimed: number;
  completed: number;
  failed: number;
  delivery: {
    configured: boolean;
    claimed: number;
    delivered: number;
    failed: number;
    retried: number;
    deadLettered: number;
    claimFailed: boolean;
    releaseFailed: number;
    deadlines: {
      configured: boolean;
      enqueued: number;
      enqueueFailed: boolean;
      claimed: number;
      delivered: number;
      failed: number;
      retried: number;
      deadLettered: number;
      claimFailed: boolean;
      releaseFailed: number;
    };
  };
  results: MonitoringResult[];
  durationMs: number;
};

function respondWithSummary(summary: MonitoringCronSummary, status: number): Response {
  const log = { event: "cron.monitoring.summary", httpStatus: status, ...summary };
  if (summary.ok) console.info(log);
  else console.error(log);
  return Response.json(summary, { status });
}

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

function profileBatchSize(): number {
  const configured = Number.parseInt(process.env.MONITORING_PROFILE_BATCH_SIZE ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_PROFILE_BATCH_SIZE;
  return Math.min(Math.max(configured, 1), MAX_PROFILE_BATCH_SIZE);
}

async function processMonitoredProfile(profile: MonitoredProfileRecord): Promise<MonitoringResult> {
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
    return { profileId: profile.id, status: "completed", newCount: newSignals.length };
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
    return { profileId: profile.id, status: "failed" };
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();
  const emailConfig = getMonitoringEmailConfig();
  const deadlineEmailConfig = getDeadlineEmailConfig();
  let alertsClaimed = 0;
  let alertsDelivered = 0;
  let alertsFailed = 0;
  let alertsRetried = 0;
  let alertsDeadLettered = 0;
  let alertsClaimFailed = false;
  let alertsReleaseFailed = 0;
  let deadlineAlertsEnqueued = 0;
  let deadlineAlertsEnqueueFailed = false;
  let deadlineAlertsClaimed = 0;
  let deadlineAlertsDelivered = 0;
  let deadlineAlertsFailed = 0;
  let deadlineAlertsRetried = 0;
  let deadlineAlertsDeadLettered = 0;
  let deadlineAlertsClaimFailed = false;
  let deadlineAlertsReleaseFailed = 0;

  let profiles;
  try {
    const requestedProfileId = new URL(request.url).searchParams.get("profileId");
    profiles = requestedProfileId && /^[0-9a-f-]{36}$/i.test(requestedProfileId)
      ? await claimMonitoredProfileById(requestedProfileId)
      : await claimDueMonitoredProfiles(profileBatchSize());
  } catch (cause) {
    console.error("Unable to claim due monitoring profiles", {
      error: cause instanceof Error ? cause.message : "Unknown monitoring storage error"
    });
    return respondWithSummary({
      ok: false,
      outcome: "storage_error",
      claimed: 0,
      completed: 0,
      failed: 0,
      delivery: {
        configured: Boolean(emailConfig),
        claimed: 0,
        delivered: 0,
        failed: 0,
        retried: 0,
        deadLettered: 0,
        claimFailed: false,
        releaseFailed: 0,
        deadlines: {
          configured: Boolean(deadlineEmailConfig),
          enqueued: 0,
          enqueueFailed: false,
          claimed: 0,
          delivered: 0,
          failed: 0,
          retried: 0,
          deadLettered: 0,
          claimFailed: false,
          releaseFailed: 0
        }
      },
      results: [],
      durationMs: Date.now() - startedAt
    }, 503);
  }

  const results = await Promise.all(profiles.map(processMonitoredProfile));

  try {
    deadlineAlertsEnqueued = await enqueueDueDeadlineAlerts(100);
  } catch (cause) {
    console.error("Unable to enqueue deadline alerts", {
      error: cause instanceof Error ? cause.message : "Unknown deadline alert error"
    });
    deadlineAlertsEnqueueFailed = true;
  }

  if (emailConfig) {
    let alerts: ClaimedMonitoringAlert[] = [];
    try {
      alerts = await claimPendingMonitoringAlerts(5);
      alertsClaimed = alerts.length;
    } catch (cause) {
      alertsClaimFailed = true;
      console.error("Unable to claim pending monitoring alerts", {
        error: cause instanceof Error ? cause.message : "Unknown monitoring alert storage error"
      });
    }
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
        alertsFailed += 1;
        try {
          await releaseMonitoringAlert(alert, cause);
          if (alert.attempt_count >= 5) alertsDeadLettered += 1;
          else alertsRetried += 1;
        } catch (releaseCause) {
          alertsReleaseFailed += 1;
          console.error("Unable to release monitoring alert", {
            alertId: alert.alert_id,
            error: releaseCause instanceof Error ? releaseCause.message : "Unknown monitoring alert storage error"
          });
        }
      }
    }
  }

  if (deadlineEmailConfig) {
    let deadlineAlerts: ClaimedDeadlineAlert[] = [];
    try {
      deadlineAlerts = await claimPendingDeadlineAlerts(5);
      deadlineAlertsClaimed = deadlineAlerts.length;
    } catch (cause) {
      deadlineAlertsClaimFailed = true;
      console.error("Unable to claim pending deadline alerts", {
        error: cause instanceof Error ? cause.message : "Unknown deadline alert storage error"
      });
    }
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
        deadlineAlertsFailed += 1;
        try {
          await releaseDeadlineAlert(alert, cause);
          if (alert.attempt_count >= 5) deadlineAlertsDeadLettered += 1;
          else deadlineAlertsRetried += 1;
        } catch (releaseCause) {
          deadlineAlertsReleaseFailed += 1;
          console.error("Unable to release deadline alert", {
            alertId: alert.alert_id,
            error: releaseCause instanceof Error ? releaseCause.message : "Unknown deadline alert storage error"
          });
        }
      }
    }
  }

  const completed = results.filter((result) => result.status === "completed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const configurationFailed = !emailConfig || !deadlineEmailConfig;
  const storageFailed = deadlineAlertsEnqueueFailed
    || alertsClaimFailed
    || alertsReleaseFailed > 0
    || deadlineAlertsClaimFailed
    || deadlineAlertsReleaseFailed > 0;
  const deliveryFailed = alertsFailed > 0
    || alertsDeadLettered > 0
    || deadlineAlertsFailed > 0
    || deadlineAlertsDeadLettered > 0;
  const ok = !configurationFailed && !storageFailed && !deliveryFailed && failed === 0;
  const status = ok ? 200 : configurationFailed || storageFailed ? 503 : deliveryFailed ? 502 : 500;

  return respondWithSummary({
    ok,
    outcome: ok
      ? "completed"
      : configurationFailed
        ? "configuration_error"
        : storageFailed
          ? "storage_error"
          : deliveryFailed
            ? "delivery_failed"
            : "run_failed",
    claimed: profiles.length,
    completed,
    failed,
    delivery: {
      configured: Boolean(emailConfig),
      claimed: alertsClaimed,
      delivered: alertsDelivered,
      failed: alertsFailed,
      retried: alertsRetried,
      deadLettered: alertsDeadLettered,
      claimFailed: alertsClaimFailed,
      releaseFailed: alertsReleaseFailed,
      deadlines: {
        configured: Boolean(deadlineEmailConfig),
        enqueued: deadlineAlertsEnqueued,
        enqueueFailed: deadlineAlertsEnqueueFailed,
        claimed: deadlineAlertsClaimed,
        delivered: deadlineAlertsDelivered,
        failed: deadlineAlertsFailed,
        retried: deadlineAlertsRetried,
        deadLettered: deadlineAlertsDeadLettered,
        claimFailed: deadlineAlertsClaimFailed,
        releaseFailed: deadlineAlertsReleaseFailed
      }
    },
    results,
    durationMs: Date.now() - startedAt
  }, status);
}
