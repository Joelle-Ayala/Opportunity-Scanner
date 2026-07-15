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

export type LaunchFunnelSnapshot = {
  generatedAt: string;
  window: {
    days: number;
    startedAt: string;
    endedAt: string;
  };
  totals: LaunchFunnelStage;
  segments: LaunchFunnelSegment[];
  notes: string[];
};

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

export function buildLaunchFunnelSnapshot(input: {
  scans: LaunchFunnelScan[];
  grants: LaunchFunnelGrant[];
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
    notes: [
      "Rates are cohort-based: active paid reports divided by completed scans created in this window.",
      "The snapshot contains aggregate campaign labels only; it excludes emails, company URLs, and report IDs.",
      ...(input.capped ? ["At least one source query reached its safety limit; use a shorter window for exact totals."] : [])
    ]
  };
}
