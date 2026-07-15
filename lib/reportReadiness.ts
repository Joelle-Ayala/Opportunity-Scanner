import type { ReportQualityEvaluation } from "./reportQuality";
import type {
  CompanyProfile,
  CompanyProfileRecord,
  ScanRecord,
  StoredOpportunitySignal
} from "./types";

export type ReportNotReadyCode =
  | "REPORT_SCAN_NOT_COMPLETED"
  | "REPORT_PROFILE_NOT_READY"
  | "REPORT_QUALITY_NOT_PASSED";

export type ReportNotReady = {
  ready: false;
  status: 409;
  code: ReportNotReadyCode;
  message: string;
  quality?: ReportQualityEvaluation;
};

export type ReadyReport = {
  ready: true;
  profile: CompanyProfile;
  signals: StoredOpportunitySignal[];
  quality: ReportQualityEvaluation;
};

export type ReportReadiness = ReportNotReady | ReadyReport;

export type ReportReadinessDependencies = {
  getCompanyProfile: (scanId: string) => Promise<CompanyProfileRecord | null>;
  listScanOpportunitySignals: (scanId: string) => Promise<StoredOpportunitySignal[]>;
  refineProfile: (profile: CompanyProfile) => CompanyProfile;
  normalizeSignals: (
    signals: readonly StoredOpportunitySignal[],
    profile: CompanyProfile
  ) => StoredOpportunitySignal[];
  evaluateQuality: (
    profile: CompanyProfile,
    signals: readonly StoredOpportunitySignal[]
  ) => ReportQualityEvaluation;
};

const DEPENDENCY_KEYS: Array<keyof ReportReadinessDependencies> = [
  "getCompanyProfile",
  "listScanOpportunitySignals",
  "refineProfile",
  "normalizeSignals",
  "evaluateQuality"
];

function hasCompleteDependencies(
  dependencies: Partial<ReportReadinessDependencies>
): dependencies is ReportReadinessDependencies {
  return DEPENDENCY_KEYS.every((key) => typeof dependencies[key] === "function");
}

async function loadDefaultDependencies(): Promise<ReportReadinessDependencies> {
  const [opportunityAction, profileRefinement, reportQuality, reportText, storage] = await Promise.all([
    import("./opportunityAction"),
    import("./profileRefinement"),
    import("./reportQuality"),
    import("./reportText"),
    import("./storage")
  ]);

  return {
    getCompanyProfile: storage.getCompanyProfile,
    listScanOpportunitySignals: storage.listScanOpportunitySignals,
    refineProfile: profileRefinement.ensureProfileRefinementFields,
    normalizeSignals: (signals, profile) =>
      signals.map((signal) => {
        const normalized = opportunityAction.withNormalizedOpportunityAction(signal, profile);
        return {
          ...normalized,
          opportunity_title: reportText.plainSourceText(normalized.opportunity_title),
          source_name: reportText.plainSourceText(normalized.source_name),
          agency_or_funder: reportText.plainSourceText(normalized.agency_or_funder),
          external_evidence_summary: reportText.plainSourceText(normalized.external_evidence_summary),
          likely_buyer_or_partner: reportText.plainSourceText(normalized.likely_buyer_or_partner),
          id: signal.id,
          created_at: signal.created_at
        };
      }),
    evaluateQuality: (profile, signals) => reportQuality.evaluateReportQuality(profile, signals, "full")
  };
}

function incompleteMessage(status: ScanRecord["status"]): string {
  if (status === "quality_review") {
    return "This report is awaiting quality review and is not ready to view, export, send, or enrich.";
  }
  if (status === "failed") {
    return "This scan did not complete, so its report data is not available.";
  }
  return "This scan is still being prepared. Report data is available only after completion.";
}

export async function getCompletedReportReadiness(
  scan: ScanRecord,
  dependencyOverrides: Partial<ReportReadinessDependencies> = {}
): Promise<ReportReadiness> {
  if (scan.status !== "completed") {
    return {
      ready: false,
      status: 409,
      code: "REPORT_SCAN_NOT_COMPLETED",
      message: incompleteMessage(scan.status)
    };
  }

  const dependencies = hasCompleteDependencies(dependencyOverrides)
    ? dependencyOverrides
    : { ...(await loadDefaultDependencies()), ...dependencyOverrides };
  const [profileRecord, storedSignals] = await Promise.all([
    dependencies.getCompanyProfile(scan.id),
    dependencies.listScanOpportunitySignals(scan.id)
  ]);

  if (!profileRecord) {
    return {
      ready: false,
      status: 409,
      code: "REPORT_PROFILE_NOT_READY",
      message: "This completed scan does not yet have a company profile ready for report use."
    };
  }

  const profile = dependencies.refineProfile(profileRecord.profile_json);
  const signals = dependencies.normalizeSignals(storedSignals, profile);
  const reportSignals = signals.filter(
    (signal) => signal.normalized_action?.show_in_report === true || signal.show_in_report === true
  );
  const quality = dependencies.evaluateQuality(profile, reportSignals);

  if (!quality.passed) {
    return {
      ready: false,
      status: 409,
      code: "REPORT_QUALITY_NOT_PASSED",
      message: "This report has not passed the required full-report quality checks and is not ready for use.",
      quality
    };
  }

  return { ready: true, profile, signals, quality };
}
