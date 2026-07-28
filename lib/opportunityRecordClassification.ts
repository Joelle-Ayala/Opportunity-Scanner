export type OpportunityRecordClass = "current" | "evidence";

export type OpportunityRecordDateInput = {
  recordClass?: OpportunityRecordClass | null;
  currentValidatedAt?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  deadline?: string | null;
  awardYear?: number | null;
  periodEnd?: string | null;
};

export type ClassifiedOpportunityRecord = {
  recordClass: OpportunityRecordClass;
  currentValidatedAt: string | null;
  closeDate: string | null;
  deadline: string | null;
  awardYear: number | null;
  periodEnd: string | null;
};

function validIsoDate(year: number, month: number, day: number): string | null {
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseOpportunityRecordDate(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[^0-9]|$)/);
  if (iso) {
    return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const us = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^0-9]|$)/);
  if (us) {
    return validIsoDate(Number(us[3]), Number(us[1]), Number(us[2]));
  }

  return null;
}

function asOfIsoDate(asOf: Date | string): string {
  if (asOf instanceof Date) {
    if (!Number.isFinite(asOf.getTime())) throw new TypeError("asOf must be a valid date");
    return asOf.toISOString().slice(0, 10);
  }

  const parsed = parseOpportunityRecordDate(asOf);
  if (!parsed) throw new TypeError("asOf must contain a parseable calendar date");
  return parsed;
}

function normalizedAwardYear(value: number | null | undefined): number | null {
  return Number.isInteger(value) && Number(value) >= 1900 && Number(value) <= 2100
    ? Number(value)
    : null;
}

const CURRENT_VALIDATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function recentValidationTimestamp(
  value: string | null | undefined,
  asOf: Date | string
): string | null {
  if (!value?.trim()) return null;
  const validatedAt = new Date(value);
  const reference = asOf instanceof Date ? asOf : new Date(`${asOfIsoDate(asOf)}T23:59:59Z`);
  if (!Number.isFinite(validatedAt.getTime()) || !Number.isFinite(reference.getTime())) return null;
  const age = reference.getTime() - validatedAt.getTime();
  return age >= 0 && age <= CURRENT_VALIDATION_MAX_AGE_MS ? validatedAt.toISOString() : null;
}

function hasEvidenceSemantics(input: OpportunityRecordDateInput): boolean {
  const sourceName = input.sourceName?.trim().toLowerCase() ?? "";
  const sourceType = input.sourceType?.trim().toLowerCase() ?? "";
  return (
    input.recordClass === "evidence" ||
    ["historical_award", "funded_buyer", "policy_signal"].includes(sourceType) ||
    sourceName.includes("usaspending") ||
    sourceName.includes("federal register")
  );
}

export function isVerifiedFutureCloseDate(
  deadline: string | null | undefined,
  asOf: Date | string = new Date()
): boolean {
  const closeDate = parseOpportunityRecordDate(deadline);
  return closeDate !== null && closeDate > asOfIsoDate(asOf);
}

export function classifyOpportunityRecord(
  input: OpportunityRecordDateInput,
  asOf: Date | string = new Date()
): ClassifiedOpportunityRecord {
  const deadline = input.deadline?.trim() || null;
  const parsedDeadline = parseOpportunityRecordDate(deadline);
  const currentValidatedAt = recentValidationTimestamp(input.currentValidatedAt, asOf);
  const isCurrent =
    parsedDeadline !== null &&
    parsedDeadline > asOfIsoDate(asOf) &&
    currentValidatedAt !== null &&
    !hasEvidenceSemantics(input);

  if (isCurrent) {
    return {
      recordClass: "current",
      currentValidatedAt,
      closeDate: parsedDeadline,
      deadline,
      awardYear: null,
      periodEnd: null
    };
  }

  return {
    recordClass: "evidence",
    currentValidatedAt: null,
    closeDate: null,
    deadline: null,
    awardYear: normalizedAwardYear(input.awardYear),
    periodEnd: parseOpportunityRecordDate(input.periodEnd) ?? parsedDeadline
  };
}
