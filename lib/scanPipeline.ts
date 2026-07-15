import { withSupabaseRequestBudget } from "./supabaseRest.ts";
import type {
  CompanyProfile,
  OpportunitySignal,
  ProfileFeedbackRecord,
  ScanInput,
  ScanRecord,
  ScrapedPage
} from "./types";
import type { ConnectorRunStatus } from "./connectors/runtime";
import type { ReportQualityEvaluation, ReportQualityTier } from "./reportQuality";
import {
  appendExternalCompanyEvidenceContext,
  appendWebsiteEvidenceContext,
  attachExternalCompanyEvidenceToProfile,
  attachWebsiteEvidenceToProfile,
  buildWebsiteProfileEvidence
} from "./companyProfileEvidence";
import type {
  CompanyEnrichmentInput,
  CompanyEnrichmentOptions,
  CompanyEnrichmentResult
} from "./companyEnrichment";

export const SCAN_FUNCTION_MAX_DURATION_MS = 60_000;
export const SCAN_EXECUTION_DEADLINE_MS = 50_000;
export const SCAN_TERMINAL_WRITE_TIMEOUT_MS = 5_000;
export const SCAN_POST_DISCOVERY_RESERVE_MS = 8_000;
export const SCAN_CONNECTOR_STATUS_WRITE_TIMEOUT_MS = 1_000;
export const SCAN_SIGNAL_WRITE_TIMEOUT_MS = 5_000;
export const SCAN_COMPLETION_WRITE_TIMEOUT_MS = 1_000;

const persistedFailureErrors = new WeakSet<object>();

const SCRAPING_STAGE_TIMEOUT_MS = 12_000;
const PROFILING_STAGE_TIMEOUT_MS = 15_000;
const STORAGE_STAGE_TIMEOUT_MS = 5_000;

type ScanStage =
  | "starting"
  | "scraping"
  | "profiling"
  | "profile feedback"
  | "profile storage"
  | "discovering"
  | "connector status storage"
  | "opportunity storage"
  | "completion storage";

export type ScanStageBudget = {
  signal: AbortSignal;
  deadlineAtMs: number;
  timeoutMs: number;
};

type UpdateScan = (
  scanId: string,
  payload: Partial<
    Pick<ScanRecord, "status" | "error_message" | "completed_at" | "selected_playbooks">
  >
) => Promise<unknown>;

type ConnectorDiscoveryResult = {
  signals: OpportunitySignal[];
  runs: ConnectorRunStatus[];
};

type ScanPipelineDependencies = {
  updateScan: UpdateScan;
  scrapeCompanyWebsite: (
    startUrl: string,
    options: ScanStageBudget
  ) => Promise<{ pages: ScrapedPage[]; rawText: string }>;
  enrichCompany: (
    input: CompanyEnrichmentInput,
    options: CompanyEnrichmentOptions
  ) => Promise<CompanyEnrichmentResult>;
  generateCompanyProfile: (
    input: ScanInput,
    rawText: string,
    options: ScanStageBudget
  ) => Promise<CompanyProfile>;
  listProfileFeedbackForCompanyUrl: (
    companyUrl: string,
    customerEmail?: string
  ) => Promise<ProfileFeedbackRecord[]>;
  applyProfileFeedbackToProfile: (
    profile: CompanyProfile,
    feedback: ProfileFeedbackRecord[]
  ) => CompanyProfile;
  saveCompanyProfile: (
    scanId: string,
    profile: CompanyProfile,
    rawText: string,
    scrapedPages: ScrapedPage[]
  ) => Promise<unknown>;
  discoverExternalSignalsWithStatus: (
    profile: CompanyProfile,
    budget: ScanStageBudget
  ) => Promise<ConnectorDiscoveryResult>;
  saveConnectorRunStatuses: (
    scanId: string,
    runs: ConnectorRunStatus[]
  ) => Promise<unknown>;
  saveOpportunitySignals: (
    scanId: string,
    signals: OpportunitySignal[],
    profile?: CompanyProfile | null
  ) => Promise<unknown>;
  normalizeOpportunitySignals: (
    signals: OpportunitySignal[],
    profile: CompanyProfile
  ) => OpportunitySignal[];
  evaluateReportQuality: (
    profile: CompanyProfile,
    signals: readonly OpportunitySignal[],
    tier: ReportQualityTier
  ) => ReportQualityEvaluation;
  now: () => number;
};

export type ScanPipelineResult = {
  status: "completed" | "quality_review";
  quality: ReportQualityEvaluation;
};

export type ScanPipelineOptions = {
  deadlineAtMs?: number;
  terminalDeadlineAtMs?: number;
  postDiscoveryReserveMs?: number;
  dependencies?: Partial<ScanPipelineDependencies>;
};

async function loadDefaultDependencies(): Promise<ScanPipelineDependencies> {
  const [companyEnrichment, discovery, opportunityAction, profile, quality, refinement, reportText, scraper, storage] = await Promise.all([
    import("./companyEnrichment"),
    import("./connectors/discover"),
    import("./opportunityAction"),
    import("./profile"),
    import("./reportQuality"),
    import("./profileRefinement"),
    import("./reportText"),
    import("./scraper"),
    import("./storage")
  ]);

  return {
    updateScan: storage.updateScan,
    scrapeCompanyWebsite: scraper.scrapeCompanyWebsite,
    enrichCompany: companyEnrichment.enrichCompany,
    generateCompanyProfile: profile.generateCompanyProfile,
    listProfileFeedbackForCompanyUrl: storage.listProfileFeedbackForCompanyUrl,
    applyProfileFeedbackToProfile: refinement.applyProfileFeedbackToProfile,
    saveCompanyProfile: storage.saveCompanyProfile,
    discoverExternalSignalsWithStatus: (companyProfile, budget) =>
      discovery.discoverExternalSignalsWithStatus(companyProfile, budget),
    saveConnectorRunStatuses: storage.saveConnectorRunStatuses,
    saveOpportunitySignals: storage.saveOpportunitySignals,
    normalizeOpportunitySignals: (signals, companyProfile) =>
      signals.map((signal) => {
        const normalized = opportunityAction.withNormalizedOpportunityAction(signal, companyProfile);
        return {
          ...normalized,
          opportunity_title: reportText.plainSourceText(normalized.opportunity_title),
          source_name: reportText.plainSourceText(normalized.source_name),
          agency_or_funder: reportText.plainSourceText(normalized.agency_or_funder),
          external_evidence_summary: reportText.plainSourceText(normalized.external_evidence_summary),
          likely_buyer_or_partner: reportText.plainSourceText(normalized.likely_buyer_or_partner)
        };
      }),
    evaluateReportQuality: quality.evaluateReportQuality,
    now: Date.now
  };
}

function hasCompleteDependencies(
  dependencies: Partial<ScanPipelineDependencies> | undefined
): dependencies is ScanPipelineDependencies {
  return Boolean(
    dependencies &&
      dependencies.updateScan &&
      dependencies.scrapeCompanyWebsite &&
      dependencies.enrichCompany &&
      dependencies.generateCompanyProfile &&
      dependencies.listProfileFeedbackForCompanyUrl &&
      dependencies.applyProfileFeedbackToProfile &&
      dependencies.saveCompanyProfile &&
      dependencies.discoverExternalSignalsWithStatus &&
      dependencies.saveConnectorRunStatuses &&
      dependencies.saveOpportunitySignals &&
      dependencies.normalizeOpportunitySignals &&
      dependencies.evaluateReportQuality &&
      dependencies.now
  );
}

export class ScanStageTimeoutError extends Error {
  readonly stage: ScanStage;

  constructor(stage: ScanStage, timeoutMs: number) {
    super(`Scan deadline exceeded during ${stage} after ${timeoutMs}ms.`);
    this.name = "ScanStageTimeoutError";
    this.stage = stage;
  }
}

export class ScanDiscoveryFailureError extends Error {
  constructor(sourceNames: string[]) {
    super(`All attempted opportunity sources failed: ${sourceNames.join(", ")}.`);
    this.name = "ScanDiscoveryFailureError";
  }
}

export function scanFailureTerminalStatePersisted(error: unknown): boolean {
  return (typeof error === "object" && error !== null) || typeof error === "function"
    ? persistedFailureErrors.has(error)
    : false;
}

export function allAttemptedSourcesFailed(runs: ConnectorRunStatus[]): boolean {
  const attemptedRuns = runs.filter((run) => run.outcome !== "skipped");
  return attemptedRuns.length > 0 && attemptedRuns.every((run) => run.outcome === "failed");
}

function failureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown scan error";
  return message.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

async function runStage<T>(
  stage: ScanStage,
  deadlineAtMs: number,
  maximumTimeoutMs: number,
  now: () => number,
  operation: (budget: ScanStageBudget) => Promise<T>,
  storageOperation = false,
  awaitAbortSettlement = false
): Promise<T> {
  const remainingMs = Math.max(0, deadlineAtMs - now());
  const timeoutMs = Math.max(0, Math.min(remainingMs, maximumTimeoutMs));
  if (timeoutMs <= 0) {
    throw new ScanStageTimeoutError(stage, 0);
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new ScanStageTimeoutError(stage, timeoutMs));
      controller.abort();
    }, timeoutMs);
  });
  const budget = {
    signal: controller.signal,
    deadlineAtMs,
    timeoutMs
  };

  const pending = storageOperation
    ? withSupabaseRequestBudget(budget, () => operation(budget))
    : operation(budget);

  try {
    return await Promise.race([pending, timeoutPromise]);
  } catch (error) {
    if (awaitAbortSettlement && controller.signal.aborted) {
      await pending.then(
        () => undefined,
        () => undefined
      );
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function persistScanFailure(
  scanId: string,
  error: unknown,
  options: {
    deadlineAtMs?: number;
    updateScan?: UpdateScan;
    now?: () => number;
  } = {}
): Promise<void> {
  const now = options.now ?? Date.now;
  const terminalDeadlineAtMs =
    options.deadlineAtMs ?? now() + SCAN_TERMINAL_WRITE_TIMEOUT_MS;
  const update = options.updateScan ?? (await import("./storage")).updateScan;

  await runStage(
    "completion storage",
    terminalDeadlineAtMs,
    SCAN_TERMINAL_WRITE_TIMEOUT_MS,
    now,
    () =>
      update(scanId, {
        status: "failed",
        error_message: failureMessage(error) || "Unknown scan error",
        completed_at: new Date(now()).toISOString()
      }).then(() => undefined),
    true
  );
}

export async function executeScanPipeline(
  scanId: string,
  input: ScanInput,
  options: ScanPipelineOptions = {}
): Promise<ScanPipelineResult> {
  const dependencies = hasCompleteDependencies(options.dependencies)
    ? options.dependencies
    : { ...(await loadDefaultDependencies()), ...options.dependencies };
  const deadlineAtMs =
    options.deadlineAtMs ?? dependencies.now() + SCAN_EXECUTION_DEADLINE_MS;
  const terminalDeadlineAtMs =
    options.terminalDeadlineAtMs ?? deadlineAtMs + SCAN_TERMINAL_WRITE_TIMEOUT_MS;
  const postDiscoveryReserveMs = Math.max(
    8,
    options.postDiscoveryReserveMs ?? SCAN_POST_DISCOVERY_RESERVE_MS
  );
  const discoveryDeadlineAtMs = deadlineAtMs - postDiscoveryReserveMs;
  const postDiscoveryBudgetScale = Math.min(
    1,
    postDiscoveryReserveMs / SCAN_POST_DISCOVERY_RESERVE_MS
  );
  const connectorStatusWriteTimeoutMs = Math.max(
    1,
    Math.floor(SCAN_CONNECTOR_STATUS_WRITE_TIMEOUT_MS * postDiscoveryBudgetScale)
  );
  const signalWriteTimeoutMs = Math.max(
    1,
    Math.floor(SCAN_SIGNAL_WRITE_TIMEOUT_MS * postDiscoveryBudgetScale)
  );
  const completionWriteTimeoutMs = Math.max(
    1,
    Math.floor(SCAN_COMPLETION_WRITE_TIMEOUT_MS * postDiscoveryBudgetScale)
  );

  const storageStage = <T>(
    stage: ScanStage,
    operation: () => Promise<T>,
    maximumTimeoutMs = STORAGE_STAGE_TIMEOUT_MS
  ) =>
    runStage(
      stage,
      deadlineAtMs,
      maximumTimeoutMs,
      dependencies.now,
      () => operation(),
      true
    );

  try {
    await storageStage("starting", () =>
      dependencies.updateScan(scanId, { status: "scraping" })
    );
    const [scraped, externalCompanyEvidence] = await runStage(
      "scraping",
      deadlineAtMs,
      SCRAPING_STAGE_TIMEOUT_MS,
      dependencies.now,
      (budget) => Promise.all([
        dependencies.scrapeCompanyWebsite(input.companyUrl, budget),
        dependencies.enrichCompany(
          { companyUrl: input.companyUrl, companyName: input.companyName },
          budget
        )
      ])
    );
    const profileEvidence = buildWebsiteProfileEvidence(
      scraped.pages,
      new Date(dependencies.now()).toISOString()
    );
    const profileSourceText = appendExternalCompanyEvidenceContext(
      appendWebsiteEvidenceContext(scraped.rawText, profileEvidence),
      externalCompanyEvidence
    );

    await storageStage("profiling", () =>
      dependencies.updateScan(scanId, { status: "profiling" })
    );
    const inferredProfile = await runStage(
      "profiling",
      deadlineAtMs,
      PROFILING_STAGE_TIMEOUT_MS,
      dependencies.now,
      (budget) => dependencies.generateCompanyProfile(input, profileSourceText, budget)
    );
    const enrichedProfile = attachExternalCompanyEvidenceToProfile(
      attachWebsiteEvidenceToProfile(
        inferredProfile,
        scraped.pages,
        input.companyUrl,
        profileEvidence,
        new Date(dependencies.now()).toISOString()
      ),
      externalCompanyEvidence
    );
    const priorFeedback = await storageStage("profile feedback", () =>
      dependencies.listProfileFeedbackForCompanyUrl(input.companyUrl, input.email)
    );
    const profile =
      priorFeedback.length > 0
        ? dependencies.applyProfileFeedbackToProfile(enrichedProfile, priorFeedback)
        : enrichedProfile;

    await storageStage("profile storage", () =>
      dependencies.updateScan(scanId, { selected_playbooks: profile.selected_playbooks })
    );
    await storageStage("profile storage", () =>
      dependencies.saveCompanyProfile(scanId, profile, scraped.rawText, scraped.pages)
    );

    await storageStage("discovering", () =>
      dependencies.updateScan(scanId, { status: "discovering" })
    );
    const discovery = await runStage(
      "discovering",
      discoveryDeadlineAtMs,
      Number.POSITIVE_INFINITY,
      dependencies.now,
      (budget) => dependencies.discoverExternalSignalsWithStatus(profile, budget),
      false,
      true
    );

    const normalizedSignals = dependencies.normalizeOpportunitySignals(discovery.signals, profile);
    const reportSignals = normalizedSignals.filter(
      (signal) => signal.normalized_action?.show_in_report === true || signal.show_in_report === true
    );
    // Every scan can become a paid report, so completion must meet the full-report standard.
    const quality = dependencies.evaluateReportQuality(profile, reportSignals, "full");

    await storageStage(
      "connector status storage",
      () => dependencies.saveConnectorRunStatuses(scanId, discovery.runs),
      connectorStatusWriteTimeoutMs
    );
    await storageStage(
      "opportunity storage",
      () => dependencies.saveOpportunitySignals(scanId, normalizedSignals, profile),
      signalWriteTimeoutMs
    );

    if (allAttemptedSourcesFailed(discovery.runs)) {
      throw new ScanDiscoveryFailureError(
        discovery.runs
          .filter((run) => run.outcome === "failed")
          .map((run) => run.source_name)
      );
    }

    if (!quality.passed) {
      const blockerCodes = quality.blockingReasons.map((reason) => reason.code).join(",");
      await storageStage(
        "completion storage",
        () =>
          dependencies.updateScan(scanId, {
            status: "quality_review",
            error_message: `QUALITY_REVIEW_REQUIRED score=${quality.score} qualifying=${quality.metrics.qualifyingOpportunityCount}/${quality.metrics.minimumQualifyingOpportunityCount} blockers=${blockerCodes}`.slice(0, 500),
            completed_at: null
          }),
        completionWriteTimeoutMs
      );
      return { status: "quality_review", quality };
    }

    await storageStage(
      "completion storage",
      () =>
        dependencies.updateScan(scanId, {
          status: "completed",
          error_message: null,
          completed_at: new Date(dependencies.now()).toISOString()
        }),
      completionWriteTimeoutMs
    );
    return { status: "completed", quality };
  } catch (error) {
    try {
      await persistScanFailure(scanId, error, {
        deadlineAtMs: terminalDeadlineAtMs,
        updateScan: dependencies.updateScan,
        now: dependencies.now
      });
      if ((typeof error === "object" && error !== null) || typeof error === "function") {
        persistedFailureErrors.add(error);
      }
    } catch (terminalError) {
      console.error("Unable to persist failed scan terminal state", {
        scanId,
        scanError: failureMessage(error),
        terminalError: failureMessage(terminalError)
      });
    }
    throw error;
  }
}
