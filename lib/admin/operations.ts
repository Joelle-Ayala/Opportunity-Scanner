import { isSamGovConfigured } from "@/lib/connectors/samGov";
import { evaluateLaunchHealth } from "@/lib/launchHealth";
import {
  getMonitoringQueueHealth,
  getMonitoringSchedulerEvidence
} from "@/lib/monitoring/storage";
import { evaluatePaidOpsHealth } from "@/lib/payments/paidOpsHealth";
import { getSubscriptionActivationRecoveryHealth } from "@/lib/payments/subscriptionActivationRecovery";
import { sourceCatalog } from "@/lib/sourceRegistry";
import { listAdminScansWithProfiles, listReportFeedbackWithContext } from "@/lib/storage";

type Availability<T> = {
  available: boolean;
  value: T | null;
};

async function safely<T>(load: () => Promise<T>): Promise<Availability<T>> {
  try {
    return { available: true, value: await load() };
  } catch {
    return { available: false, value: null };
  }
}

export type AdminOperationsSnapshot = {
  checkedAt: string;
  release: {
    version: string;
    environment: string;
  };
  launch: {
    demo: boolean;
    paidSignup: boolean;
    reportCheckout: boolean;
    subscriptionCheckout: boolean;
    support: boolean;
    analytics: boolean;
    email: boolean;
  };
  monitoring: {
    available: boolean;
    healthy: boolean;
    schedulerRecent: boolean;
    latestRunAt: string | null;
    latestHttpStatus: number | null;
    latestOutcome: string | null;
    backlog: number | null;
    retrying: number | null;
    deadLetters: number | null;
    staleLeases: number | null;
  };
  subscriptions: {
    available: boolean;
    healthy: boolean;
    activeWithoutProfile: number | null;
    pendingRecovery: number | null;
    staleRecovery: number | null;
    deadLetterRecovery: number | null;
    pendingReminder: number | null;
    deadLetterReminder: number | null;
  };
  paidReports: {
    available: boolean;
    healthy: boolean;
    recentWebhooks: number | null;
    pendingDelivery: number | null;
    failedDelivery: number | null;
    activeGrants: number | null;
    unclaimedGrants: number | null;
  };
  review: {
    available: boolean;
    held: number | null;
    completed: number | null;
    limitedTo: number;
  };
  feedback: {
    available: boolean;
    positive: number | null;
    negative: number | null;
    limitedTo: number;
  };
  sources: {
    active: number;
    needsAttention: number;
    total: number;
  };
};

export async function loadAdminOperationsSnapshot(
  now = new Date()
): Promise<AdminOperationsSnapshot> {
  const checkedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date(0).toISOString();
  const launch = evaluateLaunchHealth(process.env);
  const sources = sourceCatalog({ samGovConfigured: isSamGovConfigured() });
  const since = new Date(now.getTime() - 48 * 60 * 60_000);

  const [monitoringQueue, schedulerEvidence, subscriptionHealth, paidHealth, scans, feedback] =
    await Promise.all([
      safely(() => getMonitoringQueueHealth()),
      safely(() => getMonitoringSchedulerEvidence(since, 200)),
      safely(() => getSubscriptionActivationRecoveryHealth()),
      safely(() => evaluatePaidOpsHealth()),
      safely(() => listAdminScansWithProfiles(100)),
      safely(() => listReportFeedbackWithContext(250))
    ]);

  const latestScheduler = schedulerEvidence.value?.[0] ?? null;
  const latestSchedulerDate = latestScheduler?.completed_at
    ? new Date(latestScheduler.completed_at)
    : null;
  const schedulerRecent = Boolean(
    latestSchedulerDate
    && Number.isFinite(latestSchedulerDate.getTime())
    && now.getTime() - latestSchedulerDate.getTime() <= 30 * 60_000
    && now.getTime() >= latestSchedulerDate.getTime() - 60_000
  );
  const queue = monitoringQueue.value;
  const monitoringAvailable = monitoringQueue.available && schedulerEvidence.available;
  const monitoringHealthy = Boolean(
    monitoringAvailable
    && schedulerRecent
    && latestScheduler?.http_status === 200
    && latestScheduler.outcome === "completed"
    && (queue?.stale_lease_count ?? 0) === 0
    && (queue?.dead_letter_count ?? 0) === 0
  );

  const recovery = subscriptionHealth.value;
  const subscriptionsHealthy = Boolean(
    recovery
    && recovery.active_without_profile_count === 0
    && recovery.untracked_count === 0
    && recovery.stale_recovery_count === 0
    && recovery.dead_letter_recovery_count === 0
    && recovery.dead_letter_reminder_count === 0
  );
  const paid = paidHealth.value;
  const reviewRows = scans.value ?? [];
  const feedbackRows = feedback.value ?? [];

  return {
    checkedAt,
    release: {
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
      environment: process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "unknown"
    },
    launch: {
      demo: launch.ready.demo,
      paidSignup: launch.ready.paidSignup,
      reportCheckout: launch.ready.reportCheckout,
      subscriptionCheckout: launch.ready.subscriptionCheckout,
      support: launch.services.support,
      analytics: launch.services.analytics,
      email: launch.services.email
    },
    monitoring: {
      available: monitoringAvailable,
      healthy: monitoringHealthy,
      schedulerRecent,
      latestRunAt: latestScheduler?.completed_at ?? null,
      latestHttpStatus: latestScheduler?.http_status ?? null,
      latestOutcome: latestScheduler?.outcome ?? null,
      backlog: queue?.backlog_count ?? null,
      retrying: queue?.retrying_count ?? null,
      deadLetters: queue?.dead_letter_count ?? null,
      staleLeases: queue?.stale_lease_count ?? null
    },
    subscriptions: {
      available: subscriptionHealth.available,
      healthy: subscriptionsHealthy,
      activeWithoutProfile: recovery?.active_without_profile_count ?? null,
      pendingRecovery: recovery?.pending_recovery_count ?? null,
      staleRecovery: recovery?.stale_recovery_count ?? null,
      deadLetterRecovery: recovery?.dead_letter_recovery_count ?? null,
      pendingReminder: recovery?.pending_reminder_count ?? null,
      deadLetterReminder: recovery?.dead_letter_reminder_count ?? null
    },
    paidReports: {
      available: paidHealth.available,
      healthy: paid?.ok === true,
      recentWebhooks: paid?.checks.webhooks.recentPersisted ?? null,
      pendingDelivery: paid?.checks.delivery.pending ?? null,
      failedDelivery: paid?.checks.delivery.failed ?? null,
      activeGrants: paid?.checks.grants.active ?? null,
      unclaimedGrants: paid?.checks.claimRecovery.unclaimedActive ?? null
    },
    review: {
      available: scans.available,
      held: scans.available
        ? reviewRows.filter(({ scan }) => scan.status === "quality_review").length
        : null,
      completed: scans.available
        ? reviewRows.filter(({ scan }) => scan.status === "completed").length
        : null,
      limitedTo: 100
    },
    feedback: {
      available: feedback.available,
      positive: feedback.available
        ? feedbackRows.filter(({ feedback: item }) => item.feedback_kind === "more_like_this").length
        : null,
      negative: feedback.available
        ? feedbackRows.filter(({ feedback: item }) => item.feedback_kind === "less_like_this").length
        : null,
      limitedTo: 250
    },
    sources: {
      active: sources.filter((source) => source.status === "Active").length,
      needsAttention: sources.filter((source) =>
        source.status === "Needs API key" || source.status === "Planned"
      ).length,
      total: sources.length
    }
  };
}
