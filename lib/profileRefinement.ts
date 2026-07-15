import { applyPlaybooksToProfile } from "./playbooks";
import type { CompanyProfile, ProfileFeedbackRecord, ScanInput, StoredOpportunitySignal } from "./types";

export type ProfileSearchStrategy = {
  search_terms: string[];
  include_terms: string[];
  exclude_terms: string[];
  opportunity_lanes: string[];
  confirmed_opportunity_lanes: string[];
  rejected_opportunity_lanes: string[];
  selected_playbook_ids: string[];
  source_categories: string[];
  target_geographies: string[];
  priority_signals: string[];
  report_guidance: string[];
  profile_confidence_score: number;
};

function unique(items: Array<string | undefined | null>): string[] {
  return [...new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function splitTerms(value?: string | null): string[] {
  return unique(
    (value ?? "")
      .split(/[\n,;]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
  );
}

function jsonList(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return unique(value.filter((item): item is string => typeof item === "string"));
    }
    if (typeof value === "string") {
      return splitTerms(value);
    }
  }

  return [];
}

function normalizedSet(items: string[]): Set<string> {
  return new Set(items.map((item) => item.toLowerCase().trim()).filter(Boolean));
}

function normalizeLaneName(lane: string): string {
  if (lane === "Prop 28, arts education, and teaching artist staffing") {
    return "Arts education and teaching artist staffing";
  }

  return lane;
}

function normalizeLaneList(lanes?: string[]): string[] {
  return unique((lanes ?? []).map(normalizeLaneName));
}

function normalizeLaneSearchTerms(laneSearchTerms?: Record<string, string[]>): Record<string, string[]> {
  const normalized: Record<string, string[]> = {};
  for (const [lane, terms] of Object.entries(laneSearchTerms ?? {})) {
    const normalizedLane = normalizeLaneName(lane);
    normalized[normalizedLane] = unique([...(normalized[normalizedLane] ?? []), ...terms]);
  }

  return normalized;
}

function removeRejectedLanes(profile: CompanyProfile): CompanyProfile {
  const rejected = normalizedSet(profile.rejected_opportunity_lanes ?? []);
  if (rejected.size === 0) return profile;

  const keepLane = (lane: string) => !rejected.has(lane.toLowerCase().trim());
  const laneSearchTerms = normalizeLaneSearchTerms(profile.lane_search_terms);
  for (const lane of Object.keys(laneSearchTerms)) {
    if (!keepLane(lane)) {
      delete laneSearchTerms[lane];
    }
  }

  return {
    ...profile,
    opportunity_lanes: normalizeLaneList(profile.opportunity_lanes).filter(keepLane),
    inferred_public_sector_lanes: normalizeLaneList(profile.inferred_public_sector_lanes).filter(keepLane),
    confirmed_opportunity_lanes: normalizeLaneList(profile.confirmed_opportunity_lanes).filter(keepLane),
    lane_search_terms: laneSearchTerms
  };
}

function inferBuyerPartnerTypes(profile: CompanyProfile): string[] {
  const text = [
    ...(profile.opportunity_lanes ?? []),
    ...(profile.likely_revenue_motions ?? []),
    ...(profile.public_sector_search_terms ?? [])
  ]
    .join(" ")
    .toLowerCase();
  const types: string[] = [];

  if (/procurement|bid|solicitation|vendor/.test(text)) types.push("procurement_office");
  if (/agency|government|city|county|state|district/.test(text)) types.push("agency", "program_office");
  if (/grant|grantee|funded|award recipient/.test(text)) types.push("grantee", "award_recipient");
  if (/partner|subrecipient|prime|channel/.test(text)) types.push("prime_vendor", "channel_partner");

  return unique(types.length > 0 ? types : ["agency", "program_office", "funded_buyer"]);
}

function inferConfidence(profile: CompanyProfile): number {
  let score = 45;
  if ((profile.products_services ?? []).length > 0) score += 10;
  if ((profile.public_sector_search_terms ?? []).length >= 4) score += 10;
  if ((profile.opportunity_lanes ?? []).length > 0) score += 10;
  if ((profile.selected_playbooks ?? []).length > 0) score += 10;
  if ((profile.include_terms ?? []).length > 0 || (profile.confirmed_opportunity_lanes ?? []).length > 0) score += 10;
  if ((profile.rejected_opportunity_lanes ?? []).length > 0 || (profile.exclude_terms ?? []).length > 0) score += 5;
  return clampScore(profile.profile_confidence_score ?? score);
}

function assumptionsSummary(profile: CompanyProfile): string {
  const services = (profile.inferred_products_services ?? profile.products_services ?? []).slice(0, 4).join(", ");
  const customers = (profile.inferred_target_customers ?? profile.target_customers ?? []).slice(0, 3).join(", ");
  const lanes = (profile.confirmed_opportunity_lanes?.length
    ? profile.confirmed_opportunity_lanes
    : profile.inferred_public_sector_lanes ?? profile.opportunity_lanes ?? []
  )
    .slice(0, 4)
    .join(", ");

  return `Inferred from the company website: ${services || "products/services need review"}. Likely customers: ${
    customers || "customers need review"
  }. Public-sector lanes to test: ${lanes || "lanes need review"}.`;
}

function profileText(profile: CompanyProfile): string {
  return [
    profile.company_name,
    profile.summary,
    ...(profile.products_services ?? []),
    ...(profile.inferred_products_services ?? []),
    ...(profile.keywords ?? []),
    ...(profile.include_terms ?? []),
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

function looksKeywordy(items: string[]): boolean {
  if (items.length === 0) return true;
  const oneWordItems = items.filter((item) => item.trim().split(/\s+/).length <= 1).length;
  return oneWordItems >= Math.max(3, Math.ceil(items.length * 0.6));
}

function shouldRefreshAssumptionsSummary(profile: CompanyProfile, nextProfile: CompanyProfile): boolean {
  if (!profile.profile_assumptions_summary) return true;
  if (profile.profile_assumptions_summary.includes("Prop 28, arts education")) return true;

  const sourceProducts = profile.products_services ?? [];
  const inferredProducts = nextProfile.inferred_products_services ?? [];
  return looksKeywordy(sourceProducts) && inferredProducts.some((item) => item.trim().split(/\s+/).length > 2);
}

function inferredBusinessModel(profile: CompanyProfile): Partial<CompanyProfile> {
  const text = profileText(profile);

  if (/schoolgig|teacher hiring|substitute staffing|applicant tracking|school district recruiting|teacher recruitment|educator workforce/.test(text)) {
    return {
      inferred_products_services: [
        "K-12 teacher hiring platform",
        "school district recruiting marketplace",
        "substitute and educator staffing support",
        "applicant tracking and candidate pipeline support"
      ],
      inferred_target_customers: [
        "school districts",
        "K-12 schools",
        "district HR and talent teams",
        "education agencies"
      ],
      inferred_public_sector_lanes: [
        "K-12 hiring, teacher staffing, and educator workforce",
        "Government HR, job board, and recruiting technology procurement",
        "School district procurement and vendor registration",
        "Workforce boards and educator pipeline programs"
      ],
      inferred_buyer_partner_types: ["school_district", "agency", "program_office", "procurement_office"],
      inferred_revenue_motions: ["sell_to_agency", "procurement_bid", "sell_to_funded_buyer", "channel_or_program_partner"]
    };
  }

  if (/jammcard|live music|artist booking|performer booking|event entertainment|musician services|public concerts/.test(text)) {
    return {
      inferred_products_services: [
        "live music and performer booking",
        "music professional network",
        "event entertainment sourcing",
        "artist marketplace for public and private events"
      ],
      inferred_target_customers: [
        "cities and counties",
        "parks and recreation departments",
        "tourism boards",
        "downtown partnerships",
        "event producers"
      ],
      inferred_public_sector_lanes: [
        "City and county live performance budgets",
        "Parks and recreation concerts/events",
        "Tourism and placemaking",
        "Downtown revitalization / BID programming",
        "Public event production procurement"
      ],
      inferred_buyer_partner_types: ["agency", "program_office", "funded_buyer", "grantee", "channel_partner"],
      inferred_revenue_motions: ["sell_to_agency", "procurement_bid", "sell_to_funded_buyer", "partner_with_recipient"]
    };
  }

  if (/reparel|orthotic|prosthetic|rehab|compression|medical supply|durable medical equipment|dme|recovery sleeve/.test(text)) {
    return {
      inferred_products_services: [
        "medical recovery and support sleeves",
        "rehab and orthotic-adjacent products",
        "DME and medical supply channel products",
        "injury recovery support products"
      ],
      inferred_target_customers: [
        "medical supply distributors",
        "rehab providers",
        "VA and public healthcare buyers",
        "orthotic and prosthetic suppliers"
      ],
      inferred_public_sector_lanes: [
        "VA, prosthetics, and orthotics purchasing",
        "Medical and rehabilitation supply procurement",
        "Medical retail, distributor, and channel targets",
        "Workers' compensation and occupational health"
      ],
      inferred_buyer_partner_types: ["distributor", "agency", "procurement_office", "funded_buyer"],
      inferred_revenue_motions: ["channel_or_distributor", "sell_to_agency", "procurement_bid", "sell_to_funded_buyer"]
    };
  }

  return {};
}

export function ensureProfileRefinementFields(profile: CompanyProfile, input?: ScanInput): CompanyProfile {
  const businessModel = inferredBusinessModel(profile);
  const includeTerms = unique([...(profile.include_terms ?? []), ...splitTerms(input?.includeTerms)]);
  const excludeTerms = unique([...(profile.exclude_terms ?? []), ...splitTerms(input?.excludeTerms)]);
  const prioritySignals = unique([...(profile.priority_signals ?? []), ...(input?.prioritySignals ?? [])]);
  const targetGeographies = unique([
    ...(profile.target_geographies ?? []),
    ...(profile.geographies ?? []),
    input?.headquartersState,
    input?.targetStates
  ]);
  const productSource = businessModel.inferred_products_services ?? profile.inferred_products_services ?? profile.products_services ?? [];
  const inferredProductsServices = looksKeywordy(productSource)
    ? businessModel.inferred_products_services ?? productSource
    : productSource;
  const inferredTargetCustomers =
    businessModel.inferred_target_customers ?? profile.inferred_target_customers ?? profile.target_customers ?? [];
  const inferredLanes = normalizeLaneList(
    businessModel.inferred_public_sector_lanes ??
      profile.inferred_public_sector_lanes ??
      profile.opportunity_lanes
  );
  const inferredRevenueMotions =
    businessModel.inferred_revenue_motions ?? profile.inferred_revenue_motions ?? profile.likely_revenue_motions ?? [];

  const nextProfile: CompanyProfile = {
    ...profile,
    inferred_products_services: inferredProductsServices,
    inferred_target_customers: inferredTargetCustomers,
    inferred_public_sector_lanes: inferredLanes,
    inferred_buyer_partner_types:
      businessModel.inferred_buyer_partner_types ??
      (profile.inferred_buyer_partner_types?.length ? profile.inferred_buyer_partner_types : inferBuyerPartnerTypes(profile)),
    inferred_revenue_motions: inferredRevenueMotions,
    include_terms: includeTerms,
    exclude_terms: excludeTerms,
    target_geographies: targetGeographies,
    priority_signals: prioritySignals,
    good_fit_examples: profile.good_fit_examples ?? [],
    bad_fit_examples: profile.bad_fit_examples ?? [],
    opportunity_lanes: normalizeLaneList(profile.opportunity_lanes),
    lane_search_terms: normalizeLaneSearchTerms(profile.lane_search_terms),
    confirmed_opportunity_lanes: normalizeLaneList(profile.confirmed_opportunity_lanes),
    rejected_opportunity_lanes: normalizeLaneList(profile.rejected_opportunity_lanes)
  };

  nextProfile.profile_confidence_score = inferConfidence(nextProfile);
  nextProfile.profile_assumptions_summary = shouldRefreshAssumptionsSummary(profile, nextProfile)
    ? assumptionsSummary(nextProfile)
    : profile.profile_assumptions_summary;

  return removeRejectedLanes(nextProfile);
}

function termsFromFeedback(feedback: ProfileFeedbackRecord): string[] {
  return unique([
    ...splitTerms(feedback.value),
    ...jsonList(feedback.feedback_json, ["terms", "include_terms", "search_terms", "keywords"])
  ]);
}

function lanesFromFeedback(feedback: ProfileFeedbackRecord): string[] {
  return unique([
    ...splitTerms(feedback.value),
    ...jsonList(feedback.feedback_json, ["lanes", "opportunity_lanes"])
  ]);
}

function exampleFromFeedback(feedback: ProfileFeedbackRecord): string {
  const title = feedback.feedback_json.opportunity_title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return feedback.value || feedback.reason || feedback.feedback_kind;
}

export function applyProfileFeedbackToProfile(
  profile: CompanyProfile,
  feedbackRows: ProfileFeedbackRecord[]
): CompanyProfile {
  let nextProfile = ensureProfileRefinementFields(profile);

  for (const feedback of feedbackRows) {
    const terms = termsFromFeedback(feedback);
    const lanes = lanesFromFeedback(feedback);
    const geographies = jsonList(feedback.feedback_json, ["target_geographies", "geographies"]);
    const prioritySignals = jsonList(feedback.feedback_json, ["priority_signals"]);

    if (feedback.feedback_kind === "confirm_profile") {
      nextProfile.profile_confidence_score = clampScore((nextProfile.profile_confidence_score ?? 55) + 15);
      nextProfile.profile_assumptions_summary = `User confirmed this profile. ${assumptionsSummary(nextProfile)}`;
    }

    if (feedback.feedback_kind === "refine_profile" || feedback.feedback_kind === "add_focus") {
      nextProfile.include_terms = unique([...(nextProfile.include_terms ?? []), ...terms]);
      nextProfile.keywords = unique([...(nextProfile.keywords ?? []), ...terms]);
      nextProfile.public_sector_search_terms = unique([...(nextProfile.public_sector_search_terms ?? []), ...terms]);
      nextProfile.translated_public_sector_terms = unique([
        ...(nextProfile.translated_public_sector_terms ?? []),
        ...terms
      ]);
      nextProfile.report_guidance = unique([
        ...(nextProfile.report_guidance ?? []),
        feedback.reason || feedback.value || "User refined the opportunity focus."
      ]);
    }

    if (feedback.feedback_kind === "include_term") {
      nextProfile.include_terms = unique([...(nextProfile.include_terms ?? []), ...terms]);
      nextProfile.public_sector_search_terms = unique([...(nextProfile.public_sector_search_terms ?? []), ...terms]);
      nextProfile.translated_public_sector_terms = unique([
        ...(nextProfile.translated_public_sector_terms ?? []),
        ...terms
      ]);
    }

    if (feedback.feedback_kind === "exclude_term") {
      nextProfile.exclude_terms = unique([...(nextProfile.exclude_terms ?? []), ...terms]);
      nextProfile.negative_keywords = unique([...(nextProfile.negative_keywords ?? []), ...terms]);
    }

    if (feedback.feedback_kind === "exclude_lane") {
      nextProfile.rejected_opportunity_lanes = unique([
        ...(nextProfile.rejected_opportunity_lanes ?? []),
        ...lanes
      ]);
    }

    if (feedback.feedback_kind === "change_target_geography") {
      nextProfile.target_geographies = unique([...(nextProfile.target_geographies ?? []), ...geographies, ...terms]);
      nextProfile.geographies = unique([...(nextProfile.geographies ?? []), ...geographies, ...terms]);
    }

    if (feedback.feedback_kind === "change_priority_signal") {
      nextProfile.priority_signals = unique([...(nextProfile.priority_signals ?? []), ...prioritySignals, ...terms]);
    }

    if (feedback.feedback_kind === "more_like_this") {
      nextProfile.good_fit_examples = unique([...(nextProfile.good_fit_examples ?? []), exampleFromFeedback(feedback)]);
      nextProfile.confirmed_opportunity_lanes = unique([
        ...(nextProfile.confirmed_opportunity_lanes ?? []),
        ...lanes
      ]);
      nextProfile.include_terms = unique([...(nextProfile.include_terms ?? []), ...terms]);
    }

    if (feedback.feedback_kind === "less_like_this") {
      nextProfile.bad_fit_examples = unique([...(nextProfile.bad_fit_examples ?? []), exampleFromFeedback(feedback)]);
      nextProfile.rejected_opportunity_lanes = unique([
        ...(nextProfile.rejected_opportunity_lanes ?? []),
        ...lanes
      ]);
      nextProfile.exclude_terms = unique([...(nextProfile.exclude_terms ?? []), ...terms]);
      nextProfile.negative_keywords = unique([...(nextProfile.negative_keywords ?? []), ...terms]);
    }
  }

  const refined = applyPlaybooksToProfile({
    ...nextProfile,
    public_sector_search_terms: unique([
      ...(nextProfile.include_terms ?? []),
      ...(nextProfile.public_sector_search_terms ?? [])
    ]),
    translated_public_sector_terms: unique([
      ...(nextProfile.include_terms ?? []),
      ...(nextProfile.translated_public_sector_terms ?? [])
    ]),
    negative_keywords: unique([...(nextProfile.negative_keywords ?? []), ...(nextProfile.exclude_terms ?? [])]),
    opportunity_lanes: unique([
      ...(nextProfile.confirmed_opportunity_lanes ?? []),
      ...(nextProfile.opportunity_lanes ?? [])
    ])
  });

  return ensureProfileRefinementFields(removeRejectedLanes(refined));
}

export function buildProfileSearchStrategy(profile: CompanyProfile): ProfileSearchStrategy {
  const normalized = ensureProfileRefinementFields(profile);
  const excludeTerms = unique([...(normalized.exclude_terms ?? []), ...(normalized.negative_keywords ?? [])]);
  const rejected = normalizedSet(normalized.rejected_opportunity_lanes ?? []);
  const lanes = (normalized.opportunity_lanes ?? []).filter((lane) => !rejected.has(lane.toLowerCase().trim()));
  const searchTerms = unique([
    ...(normalized.include_terms ?? []),
    ...lanes.flatMap((lane) => normalized.lane_search_terms?.[lane] ?? []),
    ...(normalized.public_sector_search_terms ?? []),
    ...(normalized.translated_public_sector_terms ?? [])
  ]).filter((term) => !excludeTerms.some((excluded) => term.toLowerCase().includes(excluded.toLowerCase())));

  return {
    search_terms: searchTerms,
    include_terms: normalized.include_terms ?? [],
    exclude_terms: excludeTerms,
    opportunity_lanes: lanes,
    confirmed_opportunity_lanes: normalized.confirmed_opportunity_lanes ?? [],
    rejected_opportunity_lanes: normalized.rejected_opportunity_lanes ?? [],
    selected_playbook_ids: (normalized.selected_playbooks ?? []).map((playbook) => playbook.playbook_id),
    source_categories: normalized.activated_source_categories ?? [],
    target_geographies: normalized.target_geographies ?? [],
    priority_signals: normalized.priority_signals ?? [],
    report_guidance: normalized.report_guidance ?? [],
    profile_confidence_score: normalized.profile_confidence_score ?? 0
  };
}

export function feedbackJsonFromSignal(signal?: StoredOpportunitySignal | null): Record<string, unknown> {
  if (!signal) return {};
  const lane = signal.reasoning.find((item) => item.startsWith("Inferred lane:"))?.replace("Inferred lane:", "").trim();
  return {
    opportunity_title: signal.opportunity_title,
    lanes: lane ? [lane] : [],
    terms: unique([signal.query_used, signal.likely_buyer_or_partner, signal.agency_or_funder]),
    source_name: signal.source_name,
    source_type: signal.source_type
  };
}
