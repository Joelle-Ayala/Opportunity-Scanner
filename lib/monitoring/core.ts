import type { StoredOpportunitySignal } from "../types";

export type MonitoringCadence = "daily" | "weekly";

const DAY_MS = 24 * 60 * 60 * 1000;

export function nextMonitoringRunAt(cadence: MonitoringCadence, from = new Date()): Date {
  const interval = cadence === "daily" ? DAY_MS : 7 * DAY_MS;
  return new Date(from.getTime() + interval);
}

function normalizedText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedSourceUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return normalizedText(value).replace(/\/$/, "");
  }
}

export function monitoringOpportunityKey(
  signal: Pick<StoredOpportunitySignal, "source_url" | "source_name" | "opportunity_title" | "agency_or_funder">
): string {
  const sourceUrl = normalizedSourceUrl(signal.source_url);
  if (sourceUrl) return `url:${sourceUrl}`;
  return [
    "record",
    normalizedText(signal.source_name),
    normalizedText(signal.opportunity_title),
    normalizedText(signal.agency_or_funder)
  ].join(":");
}

export function findNewMonitoringSignals(
  previousSignals: StoredOpportunitySignal[],
  currentSignals: StoredOpportunitySignal[]
): StoredOpportunitySignal[] {
  const previousKeys = new Set(previousSignals.map(monitoringOpportunityKey));
  return currentSignals.filter((signal) => {
    if (signal.show_in_report === false) return false;
    return !previousKeys.has(monitoringOpportunityKey(signal));
  });
}
