import type { StoredOpportunitySignal } from "../types";
import { monitoringOpportunityKey } from "./core.ts";

export type ReportComparisonField =
  | "title"
  | "agency_or_funder"
  | "deadline"
  | "geography"
  | "source_status"
  | "source_type"
  | "revenue_pathway"
  | "likely_buyer_or_partner"
  | "recommended_action"
  | "source_url";

export type ReportFieldChange = {
  field: ReportComparisonField;
  label: string;
  before: string | null;
  after: string | null;
};

export type ReportComparisonBaseStatus = "new" | "changed" | "unchanged" | "removed";
export type ReportComparisonStatus = ReportComparisonBaseStatus | "expired";

export type ReportComparisonEntry = {
  key: string;
  status: ReportComparisonStatus;
  baseStatus: ReportComparisonBaseStatus;
  signal: StoredOpportunitySignal;
  previousSignal: StoredOpportunitySignal | null;
  changes: ReportFieldChange[];
};

export type ReportComparisonSummary = {
  current: number;
  previous: number;
  new: number;
  changed: number;
  unchanged: number;
  removed: number;
  expiredCurrent: number;
  expiredRemoved: number;
};

export type ReportComparison = {
  current: ReportComparisonEntry[];
  previous: ReportComparisonEntry[];
  summary: ReportComparisonSummary;
};

type FieldDefinition = {
  field: ReportComparisonField;
  label: string;
  value: (signal: StoredOpportunitySignal) => string | null | undefined;
  normalize?: (value: string | null | undefined) => string;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function displayValue(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeUrl(value: string | null | undefined): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    url.hash = "";
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return normalized.replace(/\/$/, "").toLowerCase();
  }
}

const COMPARISON_FIELDS: readonly FieldDefinition[] = [
  { field: "title", label: "Title", value: (signal) => signal.opportunity_title },
  { field: "agency_or_funder", label: "Agency/funder", value: (signal) => signal.agency_or_funder },
  { field: "deadline", label: "Deadline", value: (signal) => signal.deadline },
  { field: "geography", label: "Geography", value: (signal) => signal.geography },
  { field: "source_status", label: "Source status", value: (signal) => signal.source_status },
  { field: "source_type", label: "Source type", value: (signal) => signal.source_type },
  { field: "revenue_pathway", label: "Revenue pathway", value: (signal) => signal.revenue_pathway },
  {
    field: "likely_buyer_or_partner",
    label: "Likely buyer/partner",
    value: (signal) => signal.likely_buyer_or_partner
  },
  {
    field: "recommended_action",
    label: "Recommended action",
    value: (signal) => signal.recommended_action
  },
  { field: "source_url", label: "Source URL", value: (signal) => signal.source_url, normalize: normalizeUrl }
];

function fieldChanges(
  previous: StoredOpportunitySignal,
  current: StoredOpportunitySignal
): ReportFieldChange[] {
  return COMPARISON_FIELDS.flatMap((definition) => {
    const before = definition.value(previous);
    const after = definition.value(current);
    const normalize = definition.normalize ?? normalizeText;
    if (normalize(before) === normalize(after)) return [];

    return [{
      field: definition.field,
      label: definition.label,
      before: displayValue(before),
      after: displayValue(after)
    }];
  });
}

function comparisonFingerprint(signal: StoredOpportunitySignal): string {
  return JSON.stringify([
    ...COMPARISON_FIELDS.map((definition) => (definition.normalize ?? normalizeText)(definition.value(signal))),
    normalizeText(signal.id),
    normalizeText(signal.created_at)
  ]);
}

function visibleByKey(signals: StoredOpportunitySignal[]): Map<string, StoredOpportunitySignal> {
  const candidates = signals
    .filter((signal) => signal.show_in_report !== false)
    .map((signal) => ({ key: monitoringOpportunityKey(signal), signal }))
    .sort((left, right) => {
      const keyOrder = left.key.localeCompare(right.key);
      return keyOrder || comparisonFingerprint(left.signal).localeCompare(comparisonFingerprint(right.signal));
    });

  const result = new Map<string, StoredOpportunitySignal>();
  for (const candidate of candidates) {
    if (!result.has(candidate.key)) result.set(candidate.key, candidate.signal);
  }
  return result;
}

function secondaryIdentity(signal: StoredOpportunitySignal): string {
  try {
    const url = new URL(signal.source_url);
    return `source-path:${url.origin.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    // Records without a usable source URL fall back to conservative text identity.
  }
  return [
    normalizeText(signal.source_name).toLowerCase(),
    normalizeText(signal.opportunity_title).toLowerCase(),
    normalizeText(signal.agency_or_funder).toLowerCase()
  ].join(":");
}

function comparisonInstant(comparisonDate: Date | string): number {
  const instant = comparisonDate instanceof Date
    ? comparisonDate.getTime()
    : Date.parse(comparisonDate);
  if (!Number.isFinite(instant)) throw new TypeError("comparisonDate must be a valid date");
  return instant;
}

function isExpired(signal: StoredOpportunitySignal, comparisonDate: number): boolean {
  const deadline = normalizeText(signal.deadline);
  if (!deadline) return false;
  const parsed = Date.parse(deadline);
  return Number.isFinite(parsed) && parsed < comparisonDate;
}

export function compareStoredOpportunitySignals(
  previousSignals: StoredOpportunitySignal[],
  currentSignals: StoredOpportunitySignal[],
  comparisonDate: Date | string = new Date()
): ReportComparison {
  const at = comparisonInstant(comparisonDate);
  const previousByKey = visibleByKey(previousSignals);
  const currentByKey = visibleByKey(currentSignals);
  const current: ReportComparisonEntry[] = [];
  const previous: ReportComparisonEntry[] = [];
  const matchedPreviousKeys = new Set<string>();

  for (const [key, signal] of currentByKey) {
    let previousKey = previousByKey.has(key) ? key : null;
    if (!previousKey) {
      const secondary = secondaryIdentity(signal);
      const candidates = [...previousByKey.entries()].filter(
        ([candidateKey, candidate]) =>
          !matchedPreviousKeys.has(candidateKey) && secondaryIdentity(candidate) === secondary
      );
      if (candidates.length === 1) previousKey = candidates[0][0];
    }
    const previousSignal = previousKey ? previousByKey.get(previousKey) ?? null : null;
    if (previousKey) matchedPreviousKeys.add(previousKey);
    const changes = previousSignal ? fieldChanges(previousSignal, signal) : [];
    const baseStatus: ReportComparisonBaseStatus = previousSignal
      ? changes.length > 0 ? "changed" : "unchanged"
      : "new";

    current.push({
      key,
      status: isExpired(signal, at) ? "expired" : baseStatus,
      baseStatus,
      signal,
      previousSignal,
      changes
    });
  }

  for (const [key, signal] of previousByKey) {
    if (matchedPreviousKeys.has(key)) continue;
    previous.push({
      key,
      status: isExpired(signal, at) ? "expired" : "removed",
      baseStatus: "removed",
      signal,
      previousSignal: signal,
      changes: []
    });
  }

  return {
    current,
    previous,
    summary: {
      current: current.length,
      previous: previous.length,
      new: current.filter((entry) => entry.status === "new").length,
      changed: current.filter((entry) => entry.status === "changed").length,
      unchanged: current.filter((entry) => entry.status === "unchanged").length,
      removed: previous.filter((entry) => entry.status === "removed").length,
      expiredCurrent: current.filter((entry) => entry.status === "expired").length,
      expiredRemoved: previous.filter((entry) => entry.status === "expired").length
    }
  };
}

export const compareOpportunityReports = compareStoredOpportunitySignals;
