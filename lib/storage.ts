import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  CompanyProfile,
  CompanyProfileRecord,
  OpportunityEnrichmentRequestRecord,
  OpportunityEnrichmentType,
  OpportunityRecord,
  ProfileFeedbackKind,
  ProfileFeedbackRecord,
  ReportFeedbackKind,
  ReportFeedbackRecord,
  OpportunitySignal,
  ScanInput,
  ScanOpportunityRecord,
  ScanRecord,
  ScrapedPage,
  SourceResultRecord,
  StoredOpportunitySignal
} from "./types";
import {
  getSupabaseConfig,
  supabaseInsert,
  supabaseSelectMany,
  supabaseSelectOne,
  supabaseUpdate
} from "./supabaseRest";
import { withNormalizedOpportunityAction } from "./opportunityAction";

type LocalDb = {
  scans: ScanRecord[];
  company_profiles: CompanyProfileRecord[];
  source_results: SourceResultRecord[];
  opportunities: OpportunityRecord[];
  scan_opportunities: ScanOpportunityRecord[];
  report_feedback: ReportFeedbackRecord[];
  profile_feedback: ProfileFeedbackRecord[];
  opportunity_enrichment_requests: OpportunityEnrichmentRequestRecord[];
};

const localDbPath = path.join(process.cwd(), ".data", "local-db.json");

async function readLocalDb(): Promise<LocalDb> {
  try {
    const raw = await fs.readFile(localDbPath, "utf8");
    return JSON.parse(raw) as LocalDb;
  } catch {
    return {
      scans: [],
      company_profiles: [],
      source_results: [],
      opportunities: [],
      scan_opportunities: [],
      report_feedback: [],
      profile_feedback: [],
      opportunity_enrichment_requests: []
    };
  }
}

function normalizeLocalDb(db: Partial<LocalDb>): LocalDb {
  return {
    scans: db.scans ?? [],
    company_profiles: db.company_profiles ?? [],
    source_results: db.source_results ?? [],
    opportunities: db.opportunities ?? [],
    scan_opportunities: db.scan_opportunities ?? [],
    report_feedback: db.report_feedback ?? [],
    profile_feedback: db.profile_feedback ?? [],
    opportunity_enrichment_requests: db.opportunity_enrichment_requests ?? []
  };
}

async function writeLocalDb(db: LocalDb): Promise<void> {
  await fs.mkdir(path.dirname(localDbPath), { recursive: true });
  await fs.writeFile(localDbPath, JSON.stringify(db, null, 2));
}

function usesSupabase(): boolean {
  return Boolean(getSupabaseConfig());
}

export async function createScan(input: ScanInput): Promise<ScanRecord> {
  const payload = {
    company_url: input.companyUrl,
    company_name: input.companyName || null,
    headquarters_state: input.headquartersState || null,
    target_states: input.targetStates || null,
    industry: input.industry || null,
    customer_type: input.customerType || null,
    email: input.email || null,
    report_type: input.reportType,
    report_access: "free" as const,
    opportunity_focus: input.opportunityFocus || null,
    include_terms: input.includeTerms || null,
    exclude_terms: input.excludeTerms || null,
    priority_signals: input.prioritySignals || [],
    status: "queued",
    selected_playbooks: []
  };

  if (usesSupabase()) {
    return supabaseInsert<ScanRecord>("scans", payload);
  }

  const db = await readLocalDb();
  const normalized = normalizeLocalDb(db);
  const record: ScanRecord = {
    id: randomUUID(),
    ...payload,
    status: "queued",
    report_type: input.reportType,
    created_at: new Date().toISOString(),
    completed_at: null
  };
  normalized.scans.push(record);
  await writeLocalDb(normalized);
  return record;
}

export async function updateScan(
  id: string,
  payload: Partial<Pick<ScanRecord, "status" | "error_message" | "completed_at" | "selected_playbooks">>
): Promise<ScanRecord> {
  if (usesSupabase()) {
    return supabaseUpdate<ScanRecord>("scans", id, payload);
  }

  const db = normalizeLocalDb(await readLocalDb());
  const idx = db.scans.findIndex((scan) => scan.id === id);
  if (idx === -1) {
    throw new Error("Scan not found.");
  }

  db.scans[idx] = { ...db.scans[idx], ...payload };
  await writeLocalDb(db);
  return db.scans[idx];
}

export async function saveCompanyProfile(
  scanId: string,
  profile: CompanyProfile,
  rawText: string,
  scrapedPages: ScrapedPage[]
): Promise<CompanyProfileRecord> {
  const payload = {
    scan_id: scanId,
    profile_json: profile,
    raw_text: rawText,
    scraped_pages: scrapedPages
  };

  if (usesSupabase()) {
    return supabaseInsert<CompanyProfileRecord>("company_profiles", payload);
  }

  const db = normalizeLocalDb(await readLocalDb());
  const record: CompanyProfileRecord = {
    id: randomUUID(),
    ...payload,
    created_at: new Date().toISOString()
  };
  db.company_profiles.push(record);
  await writeLocalDb(db);
  return record;
}

export async function getScan(id: string): Promise<ScanRecord | null> {
  if (usesSupabase()) {
    return supabaseSelectOne<ScanRecord>("scans", `id=eq.${id}`);
  }

  const db = normalizeLocalDb(await readLocalDb());
  return db.scans.find((scan) => scan.id === id) ?? null;
}

export async function getCompanyProfile(scanId: string): Promise<CompanyProfileRecord | null> {
  if (usesSupabase()) {
    return supabaseSelectOne<CompanyProfileRecord>(
      "company_profiles",
      `scan_id=eq.${scanId}&order=created_at.desc`
    );
  }

  const db = normalizeLocalDb(await readLocalDb());
  return (
    db.company_profiles
      .filter((profile) => profile.scan_id === scanId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

export async function updateCompanyProfile(
  profileId: string,
  profile: CompanyProfile
): Promise<CompanyProfileRecord> {
  const payload = {
    profile_json: profile
  };

  if (usesSupabase()) {
    return supabaseUpdate<CompanyProfileRecord>("company_profiles", profileId, payload);
  }

  const db = normalizeLocalDb(await readLocalDb());
  const idx = db.company_profiles.findIndex((record) => record.id === profileId);
  if (idx === -1) {
    throw new Error("Company profile not found.");
  }

  db.company_profiles[idx] = { ...db.company_profiles[idx], ...payload };
  await writeLocalDb(db);
  return db.company_profiles[idx];
}

export async function listCompletedScans(limit = 50): Promise<ScanRecord[]> {
  if (usesSupabase()) {
    return supabaseSelectMany<ScanRecord>(
      "scans",
      `status=eq.completed&order=completed_at.desc&limit=${limit}`
    );
  }

  const db = normalizeLocalDb(await readLocalDb());
  return db.scans
    .filter((scan) => scan.status === "completed")
    .sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))
    .slice(0, limit);
}

export async function listCompletedScansWithProfiles(limit = 50): Promise<
  Array<{
    scan: ScanRecord;
    profile: CompanyProfileRecord | null;
  }>
> {
  const scans = await listCompletedScans(limit);
  const profiles = await Promise.all(scans.map((scan) => getCompanyProfile(scan.id)));
  return scans.map((scan, index) => ({
    scan,
    profile: profiles[index]
  }));
}

export async function saveOpportunitySignals(
  scanId: string,
  signals: OpportunitySignal[],
  profile?: CompanyProfile | null
): Promise<StoredOpportunitySignal[]> {
  const saved: StoredOpportunitySignal[] = [];

  for (const signal of signals) {
    const normalizedSignal = withNormalizedOpportunityAction(signal, profile);

    if (usesSupabase()) {
      await supabaseInsert<SourceResultRecord>("source_results", {
        scan_id: scanId,
        source_name: normalizedSignal.source_name,
        source_type: normalizedSignal.source_type,
        query_used: normalizedSignal.query_used,
        title: normalizedSignal.opportunity_title,
        url: normalizedSignal.source_url,
        raw_json: normalizedSignal.raw_json
      });

      const opportunity = await supabaseInsert<OpportunityRecord>("opportunities", {
        source: normalizedSignal.source_name,
        source_id: normalizedSignal.source_url,
        title: normalizedSignal.opportunity_title,
        url: normalizedSignal.source_url,
        agency: normalizedSignal.agency_or_funder,
        category: normalizedSignal.source_type,
        deadline: normalizedSignal.deadline || null,
        geography: normalizedSignal.geography || null,
        raw_json: normalizedSignal
      });

      await supabaseInsert<ScanOpportunityRecord>("scan_opportunities", {
        scan_id: scanId,
        opportunity_id: opportunity.id,
        relevance_score: normalizedSignal.relevance_score,
        novelty_score: normalizedSignal.novelty_score,
        confidence_score: normalizedSignal.confidence_score,
        reasoning_json: normalizedSignal.reasoning,
        recommended_action: normalizedSignal.recommended_action,
        human_review_required: normalizedSignal.human_review_required,
        hidden: false
      });

      saved.push({
        ...normalizedSignal,
        id: opportunity.id,
        created_at: opportunity.created_at
      });
      continue;
    }

    const db = normalizeLocalDb(await readLocalDb());
    const now = new Date().toISOString();
    const sourceResult: SourceResultRecord = {
      id: randomUUID(),
      scan_id: scanId,
      source_name: normalizedSignal.source_name,
      source_type: normalizedSignal.source_type,
      query_used: normalizedSignal.query_used,
      title: normalizedSignal.opportunity_title,
      url: normalizedSignal.source_url,
      raw_json: normalizedSignal.raw_json,
      created_at: now
    };
    const opportunity: OpportunityRecord = {
      id: randomUUID(),
      source: normalizedSignal.source_name,
      source_id: normalizedSignal.source_url,
      title: normalizedSignal.opportunity_title,
      url: normalizedSignal.source_url,
      agency: normalizedSignal.agency_or_funder,
      category: normalizedSignal.source_type,
      deadline: normalizedSignal.deadline,
      geography: normalizedSignal.geography,
      raw_json: normalizedSignal,
      created_at: now
    };
    const scanOpportunity: ScanOpportunityRecord = {
      id: randomUUID(),
      scan_id: scanId,
      opportunity_id: opportunity.id,
      relevance_score: normalizedSignal.relevance_score,
      novelty_score: normalizedSignal.novelty_score,
      confidence_score: normalizedSignal.confidence_score,
      reasoning_json: normalizedSignal.reasoning,
      recommended_action: normalizedSignal.recommended_action,
      human_review_required: normalizedSignal.human_review_required,
      hidden: false,
      created_at: now
    };

    db.source_results.push(sourceResult);
    db.opportunities.push(opportunity);
    db.scan_opportunities.push(scanOpportunity);
    await writeLocalDb(db);

    saved.push({
      ...normalizedSignal,
      id: opportunity.id,
      created_at: now
    });
  }

  return saved;
}

export async function listScanOpportunitySignals(scanId: string): Promise<StoredOpportunitySignal[]> {
  if (usesSupabase()) {
    const scanOpportunities = await supabaseSelectMany<ScanOpportunityRecord>(
      "scan_opportunities",
      `scan_id=eq.${scanId}&order=created_at.desc`
    );
    const visibleScanOpportunities = scanOpportunities.filter((item) => item.hidden !== true);
    const opportunities = await Promise.all(
      visibleScanOpportunities.map((item) =>
        supabaseSelectOne<OpportunityRecord>("opportunities", `id=eq.${item.opportunity_id}`)
      )
    );

    return opportunities
      .map((opportunity, index) => {
        if (!opportunity) {
          return null;
        }
        const raw = opportunity.raw_json as unknown as OpportunitySignal;
        return {
          ...raw,
          id: opportunity.id,
          relevance_score: visibleScanOpportunities[index].relevance_score,
          novelty_score: visibleScanOpportunities[index].novelty_score,
          confidence_score: visibleScanOpportunities[index].confidence_score,
          reasoning: visibleScanOpportunities[index].reasoning_json,
          recommended_action: visibleScanOpportunities[index].recommended_action ?? raw.recommended_action,
          human_review_required: visibleScanOpportunities[index].human_review_required,
          created_at: opportunity.created_at
        };
      })
      .filter((signal): signal is StoredOpportunitySignal => Boolean(signal));
  }

  const db = normalizeLocalDb(await readLocalDb());
  return db.scan_opportunities
    .filter((item) => item.scan_id === scanId && item.hidden !== true)
    .map((scanOpportunity) => {
      const opportunity = db.opportunities.find((item) => item.id === scanOpportunity.opportunity_id);
      if (!opportunity) {
        return null;
      }
      const raw = opportunity.raw_json as unknown as OpportunitySignal;
      return {
        ...raw,
        id: opportunity.id,
        relevance_score: scanOpportunity.relevance_score,
        novelty_score: scanOpportunity.novelty_score,
        confidence_score: scanOpportunity.confidence_score,
        reasoning: scanOpportunity.reasoning_json,
        recommended_action: scanOpportunity.recommended_action ?? raw.recommended_action,
        human_review_required: scanOpportunity.human_review_required,
        created_at: opportunity.created_at
      };
    })
    .filter((signal): signal is StoredOpportunitySignal => Boolean(signal))
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

export async function getStoredOpportunitySignal(
  scanId: string,
  opportunityId: string
): Promise<StoredOpportunitySignal | null> {
  const signals = await listScanOpportunitySignals(scanId);
  return signals.find((signal) => signal.id === opportunityId) ?? null;
}

export async function hideScanOpportunity(input: {
  scanId: string;
  opportunityId: string;
}): Promise<void> {
  if (usesSupabase()) {
    const scanOpportunity = await supabaseSelectOne<ScanOpportunityRecord>(
      "scan_opportunities",
      `scan_id=eq.${input.scanId}&opportunity_id=eq.${input.opportunityId}`
    );
    if (scanOpportunity) {
      await supabaseUpdate<ScanOpportunityRecord>("scan_opportunities", scanOpportunity.id, {
        hidden: true
      });
    }
    return;
  }

  const db = normalizeLocalDb(await readLocalDb());
  db.scan_opportunities = db.scan_opportunities.map((item) =>
    item.scan_id === input.scanId && item.opportunity_id === input.opportunityId
      ? { ...item, hidden: true }
      : item
  );
  await writeLocalDb(db);
}

export async function saveReportFeedback(input: {
  scanId: string;
  opportunityId?: string | null;
  feedbackKind: ReportFeedbackKind;
  reason?: string | null;
}): Promise<ReportFeedbackRecord> {
  const payload = {
    scan_id: input.scanId,
    opportunity_id: input.opportunityId || null,
    feedback_kind: input.feedbackKind,
    reason: input.reason?.trim() || null
  };

  if (usesSupabase()) {
    return supabaseInsert<ReportFeedbackRecord>("report_feedback", payload);
  }

  const db = normalizeLocalDb(await readLocalDb());
  const record: ReportFeedbackRecord = {
    id: randomUUID(),
    ...payload,
    created_at: new Date().toISOString()
  };
  db.report_feedback.push(record);
  await writeLocalDb(db);
  return record;
}

export async function listReportFeedbackWithContext(limit = 100): Promise<
  Array<{
    feedback: ReportFeedbackRecord;
    scan: ScanRecord | null;
    signal: StoredOpportunitySignal | null;
  }>
> {
  let feedbackRows: ReportFeedbackRecord[];

  if (usesSupabase()) {
    feedbackRows = await supabaseSelectMany<ReportFeedbackRecord>(
      "report_feedback",
      `order=created_at.desc&limit=${limit}`
    );
  } else {
    const db = normalizeLocalDb(await readLocalDb());
    feedbackRows = [...db.report_feedback]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  return Promise.all(
    feedbackRows.map(async (feedback) => ({
      feedback,
      scan: await getScan(feedback.scan_id),
      signal: feedback.opportunity_id
        ? await getStoredOpportunitySignal(feedback.scan_id, feedback.opportunity_id)
        : null
    }))
  );
}

export async function saveProfileFeedback(input: {
  scanId: string;
  companyProfileId?: string | null;
  companyUrl?: string | null;
  opportunityId?: string | null;
  feedbackKind: ProfileFeedbackKind;
  value?: string | null;
  reason?: string | null;
  feedbackJson?: Record<string, unknown>;
}): Promise<ProfileFeedbackRecord> {
  const payload = {
    scan_id: input.scanId,
    company_profile_id: input.companyProfileId || null,
    company_url: input.companyUrl || null,
    opportunity_id: input.opportunityId || null,
    feedback_kind: input.feedbackKind,
    value: input.value?.trim() || null,
    reason: input.reason?.trim() || null,
    feedback_json: input.feedbackJson ?? {}
  };

  if (usesSupabase()) {
    return supabaseInsert<ProfileFeedbackRecord>("profile_feedback", payload);
  }

  const db = normalizeLocalDb(await readLocalDb());
  const record: ProfileFeedbackRecord = {
    id: randomUUID(),
    ...payload,
    created_at: new Date().toISOString()
  };
  db.profile_feedback.push(record);
  await writeLocalDb(db);
  return record;
}

export async function listProfileFeedbackForScan(scanId: string): Promise<ProfileFeedbackRecord[]> {
  if (usesSupabase()) {
    return supabaseSelectMany<ProfileFeedbackRecord>(
      "profile_feedback",
      `scan_id=eq.${scanId}&order=created_at.asc`
    );
  }

  const db = normalizeLocalDb(await readLocalDb());
  return db.profile_feedback
    .filter((feedback) => feedback.scan_id === scanId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function listProfileFeedbackForCompanyUrl(companyUrl: string): Promise<ProfileFeedbackRecord[]> {
  if (usesSupabase()) {
    return supabaseSelectMany<ProfileFeedbackRecord>(
      "profile_feedback",
      `company_url=eq.${encodeURIComponent(companyUrl)}&order=created_at.asc`
    );
  }

  const db = normalizeLocalDb(await readLocalDb());
  return db.profile_feedback
    .filter((feedback) => feedback.company_url === companyUrl)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveOpportunityEnrichmentRequest(input: {
  scanId: string;
  opportunityId: string;
  enrichmentType: OpportunityEnrichmentType;
  status?: OpportunityEnrichmentRequestRecord["status"];
  resultJson?: Record<string, unknown>;
}): Promise<OpportunityEnrichmentRequestRecord> {
  const payload = {
    scan_id: input.scanId,
    opportunity_id: input.opportunityId,
    enrichment_type: input.enrichmentType,
    status: input.status ?? "requested",
    result_json: input.resultJson ?? {}
  };

  if (usesSupabase()) {
    return supabaseInsert<OpportunityEnrichmentRequestRecord>(
      "opportunity_enrichment_requests",
      payload
    );
  }

  const db = normalizeLocalDb(await readLocalDb());
  const record: OpportunityEnrichmentRequestRecord = {
    id: randomUUID(),
    ...payload,
    status: payload.status,
    created_at: new Date().toISOString()
  };
  db.opportunity_enrichment_requests.push(record);
  await writeLocalDb(db);
  return record;
}

export async function listOpportunityEnrichmentRequests(
  scanId: string,
  opportunityId: string
): Promise<OpportunityEnrichmentRequestRecord[]> {
  if (usesSupabase()) {
    return supabaseSelectMany<OpportunityEnrichmentRequestRecord>(
      "opportunity_enrichment_requests",
      `scan_id=eq.${scanId}&opportunity_id=eq.${opportunityId}&order=created_at.desc`
    );
  }

  const db = normalizeLocalDb(await readLocalDb());
  return db.opportunity_enrichment_requests
    .filter((item) => item.scan_id === scanId && item.opportunity_id === opportunityId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
