import type { BillingInterval, PaymentPlan } from "./payments/contract";
import {
  buildSubscriptionLifecycleAnalytics,
  type SubscriptionAnalyticsProfile,
  type SubscriptionLifecycleAnalytics
} from "./subscriptionAnalytics.ts";

export type LaunchFunnelScan = {
  id: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

export type LaunchFunnelGrant = {
  scan_id: string;
  status: "active" | "refunded" | "disputed" | string;
};

export type LaunchFunnelSubscription = {
  stripe_customer_id?: string | null;
  product?: string | null;
  billing_interval?: string | null;
  status: string;
  livemode: boolean;
  created_at: string;
  canceled_at?: string | null;
};

export type LaunchFunnelStage = {
  scans: number;
  completed: number;
  failed: number;
  inProgress: number;
  activePaidReports: number;
  refundedReports: number;
  disputedReports: number;
  completionRate: number;
  paidConversionRate: number;
};

export type LaunchFunnelSegment = LaunchFunnelStage & {
  source: string;
  medium: string;
  campaign: string;
};

export type LaunchFunnelPlanMix = {
  activeSubscriptions: number;
  normalizedMrr: number;
  subscriptionShare: number;
};

export type LaunchFunnelMrrScorecard = {
  currency: "USD";
  targetMrr: number;
  activeNormalizedMrr: number;
  remainingToTarget: number;
  progressToTarget: number;
  activeSubscriptions: number;
  planMix: Record<BillingInterval, LaunchFunnelPlanMix>;
  productMix: Record<Exclude<PaymentPlan, "report">, LaunchFunnelPlanMix>;
  newSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  lifecycle: SubscriptionLifecycleAnalytics;
  notes: string[];
};

export type LaunchFunnelSnapshot = {
  generatedAt: string;
  window: {
    days: number;
    startedAt: string;
    endedAt: string;
  };
  totals: LaunchFunnelStage;
  segments: LaunchFunnelSegment[];
  mrrScorecard: LaunchFunnelMrrScorecard;
  notes: string[];
};

type SubscriptionCatalogEntry = {
  product: Exclude<PaymentPlan, "report">;
  interval: BillingInterval;
  contractValue: number;
};

const MRR_TARGET = 10_000;
const SUBSCRIPTION_CATALOG: readonly SubscriptionCatalogEntry[] = [
  { product: "monitor", interval: "monthly", contractValue: 99 },
  { product: "monitor", interval: "annual", contractValue: 990 },
  { product: "growth", interval: "monthly", contractValue: 249 },
  { product: "growth", interval: "annual", contractValue: 2_490 }
];

const COUNTABLE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "canceled"]);

type MutableStage = Omit<LaunchFunnelStage, "completionRate" | "paidConversionRate">;

function emptyStage(): MutableStage {
  return {
    scans: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    activePaidReports: 0,
    refundedReports: 0,
    disputedReports: 0
  };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function currency(value: number): number {
  return Math.round(value * 100) / 100;
}

function finalizeStage(stage: MutableStage): LaunchFunnelStage {
  return {
    ...stage,
    completionRate: percentage(stage.completed, stage.scans),
    paidConversionRate: percentage(stage.activePaidReports, stage.completed)
  };
}

function safeDimension(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 160) : fallback;
}

function segmentKey(scan: LaunchFunnelScan): string {
  return [
    safeDimension(scan.utm_source, "direct_or_unknown"),
    safeDimension(scan.utm_medium, "unknown"),
    safeDimension(scan.utm_campaign, "unattributed")
  ].join("\u001f");
}

function paidStateByScan(grants: LaunchFunnelGrant[]): Map<string, LaunchFunnelGrant["status"]> {
  const states = new Map<string, LaunchFunnelGrant["status"]>();
  for (const grant of grants) {
    if (!grant.scan_id) continue;
    const current = states.get(grant.scan_id);
    if (grant.status === "active" || !current) {
      states.set(grant.scan_id, grant.status);
    } else if (grant.status === "disputed" && current !== "active") {
      states.set(grant.scan_id, grant.status);
    }
  }
  return states;
}

function applyScan(stage: MutableStage, scan: LaunchFunnelScan, paidState?: string): void {
  stage.scans += 1;
  if (scan.status === "completed") stage.completed += 1;
  else if (scan.status === "failed") stage.failed += 1;
  else stage.inProgress += 1;

  if (paidState === "active") stage.activePaidReports += 1;
  else if (paidState === "refunded") stage.refundedReports += 1;
  else if (paidState === "disputed") stage.disputedReports += 1;
}

function subscriptionCatalogEntry(subscription: LaunchFunnelSubscription): SubscriptionCatalogEntry | null {
  if (!subscription.livemode) return null;
  return SUBSCRIPTION_CATALOG.find(
    (entry) => entry.product === subscription.product && entry.interval === subscription.billing_interval
  ) ?? null;
}

function buildMrrScorecard(input: {
  subscriptions: LaunchFunnelSubscription[];
  profiles?: SubscriptionAnalyticsProfile[];
  subscriptionDataAvailable: boolean;
  startedAt: Date;
  now: Date;
}): LaunchFunnelMrrScorecard {
  const planMix: Record<BillingInterval, LaunchFunnelPlanMix> = {
    monthly: { activeSubscriptions: 0, normalizedMrr: 0, subscriptionShare: 0 },
    annual: { activeSubscriptions: 0, normalizedMrr: 0, subscriptionShare: 0 }
  };
  const productMix: Record<Exclude<PaymentPlan, "report">, LaunchFunnelPlanMix> = {
    monitor: { activeSubscriptions: 0, normalizedMrr: 0, subscriptionShare: 0 },
    growth: { activeSubscriptions: 0, normalizedMrr: 0, subscriptionShare: 0 }
  };
  let newSubscriptions = 0;
  let canceledSubscriptions = 0;
  let pastDueSubscriptions = 0;

  for (const subscription of input.subscriptions) {
    const catalogEntry = subscriptionCatalogEntry(subscription);
    if (!catalogEntry) continue;

    const createdAt = Date.parse(subscription.created_at);
    if (
      COUNTABLE_SUBSCRIPTION_STATUSES.has(subscription.status) &&
      Number.isFinite(createdAt) &&
      createdAt >= input.startedAt.getTime() &&
      createdAt <= input.now.getTime()
    ) {
      newSubscriptions += 1;
    }

    const canceledAt = Date.parse(subscription.canceled_at ?? "");
    if (
      subscription.status === "canceled" &&
      Number.isFinite(canceledAt) &&
      canceledAt >= input.startedAt.getTime() &&
      canceledAt <= input.now.getTime()
    ) {
      canceledSubscriptions += 1;
    }

    if (subscription.status === "past_due") pastDueSubscriptions += 1;
    if (subscription.status !== "active") continue;

    planMix[catalogEntry.interval].activeSubscriptions += 1;
    planMix[catalogEntry.interval].normalizedMrr +=
      catalogEntry.contractValue / (catalogEntry.interval === "annual" ? 12 : 1);
    productMix[catalogEntry.product].activeSubscriptions += 1;
    productMix[catalogEntry.product].normalizedMrr +=
      catalogEntry.contractValue / (catalogEntry.interval === "annual" ? 12 : 1);
  }

  const activeSubscriptions = planMix.monthly.activeSubscriptions + planMix.annual.activeSubscriptions;
  const activeNormalizedMrr = currency(planMix.monthly.normalizedMrr + planMix.annual.normalizedMrr);
  for (const interval of ["monthly", "annual"] as const) {
    planMix[interval].normalizedMrr = currency(planMix[interval].normalizedMrr);
    planMix[interval].subscriptionShare = percentage(planMix[interval].activeSubscriptions, activeSubscriptions);
  }
  for (const product of ["monitor", "growth"] as const) {
    productMix[product].normalizedMrr = currency(productMix[product].normalizedMrr);
    productMix[product].subscriptionShare = percentage(productMix[product].activeSubscriptions, activeSubscriptions);
  }

  return {
    currency: "USD",
    targetMrr: MRR_TARGET,
    activeNormalizedMrr,
    remainingToTarget: currency(Math.max(0, MRR_TARGET - activeNormalizedMrr)),
    progressToTarget: percentage(activeNormalizedMrr, MRR_TARGET),
    activeSubscriptions,
    planMix,
    productMix,
    newSubscriptions,
    canceledSubscriptions,
    pastDueSubscriptions,
    lifecycle: buildSubscriptionLifecycleAnalytics({
      subscriptions: input.subscriptionDataAvailable ? input.subscriptions : undefined,
      profiles: input.profiles,
      startedAt: input.startedAt,
      now: input.now
    }),
    notes: [
      "MRR uses the fixed Monitor and Growth catalog values; annual contract value is divided by 12.",
      "Only live-mode, server-normalized catalog subscriptions with active status contribute to MRR and plan mix.",
      "New and canceled counts use this reporting window; past-due is the current aggregate count."
    ]
  };
}

export function buildLaunchFunnelSnapshot(input: {
  scans: LaunchFunnelScan[];
  grants: LaunchFunnelGrant[];
  subscriptions?: LaunchFunnelSubscription[];
  profiles?: SubscriptionAnalyticsProfile[];
  days: number;
  now?: Date;
  capped?: boolean;
}): LaunchFunnelSnapshot {
  const now = input.now ?? new Date();
  const days = Math.max(1, Math.min(90, Math.floor(input.days)));
  const startedAt = new Date(now.getTime() - days * 86_400_000);
  const paidStates = paidStateByScan(input.grants);
  const totals = emptyStage();
  const segmentStages = new Map<string, MutableStage>();
  const scansBySegment = new Map<string, LaunchFunnelScan>();

  for (const scan of input.scans) {
    const createdAt = Date.parse(scan.created_at);
    if (!scan.id || !Number.isFinite(createdAt) || createdAt < startedAt.getTime() || createdAt > now.getTime()) {
      continue;
    }
    const key = segmentKey(scan);
    const stage = segmentStages.get(key) ?? emptyStage();
    applyScan(stage, scan, paidStates.get(scan.id));
    applyScan(totals, scan, paidStates.get(scan.id));
    segmentStages.set(key, stage);
    scansBySegment.set(key, scan);
  }

  const segments = [...segmentStages.entries()]
    .map(([key, stage]) => {
      const scan = scansBySegment.get(key)!;
      return {
        source: safeDimension(scan.utm_source, "direct_or_unknown"),
        medium: safeDimension(scan.utm_medium, "unknown"),
        campaign: safeDimension(scan.utm_campaign, "unattributed"),
        ...finalizeStage(stage)
      };
    })
    .sort((left, right) => right.scans - left.scans || right.activePaidReports - left.activePaidReports);

  return {
    generatedAt: now.toISOString(),
    window: {
      days,
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString()
    },
    totals: finalizeStage(totals),
    segments,
    mrrScorecard: buildMrrScorecard({
      subscriptions: input.subscriptions ?? [],
      profiles: input.profiles,
      subscriptionDataAvailable: input.subscriptions !== undefined,
      startedAt,
      now
    }),
    notes: [
      "Rates are cohort-based: active paid reports divided by completed scans created in this window.",
      "The snapshot contains aggregate campaign labels only; it excludes emails, company URLs, and report IDs.",
      ...(input.capped ? ["At least one source query reached its safety limit; use a shorter window for exact totals."] : [])
    ]
  };
}
