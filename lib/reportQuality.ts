import type { CompanyProfile, NormalizedOpportunityAction, OpportunitySignal } from "./types";
import { parseOutboundUrl } from "./url";

export type ReportQualityTier = "preview" | "full";

export type ReportQualityRequirement =
  | "companyCorrectEvidence"
  | "validSourceUrl"
  | "concreteTargetOrganization"
  | "validRevenueMotion"
  | "nextActionAndContactPath"
  | "actionability"
  | "uniqueOpportunity"
  | "noHtmlLeakage";

export type ReportQualityBlockingCode =
  | "PROFILE_CONTEXT_INSUFFICIENT"
  | "PROFILE_CONFIDENCE_LOW"
  | "INSUFFICIENT_OPPORTUNITIES"
  | "INSUFFICIENT_QUALIFYING_OPPORTUNITIES"
  | "COMPANY_EVIDENCE_MISSING"
  | "INVALID_SOURCE_URL"
  | "TARGET_ORGANIZATION_MISSING"
  | "REVENUE_MOTION_MISSING"
  | "NEXT_ACTION_OR_CONTACT_PATH_MISSING"
  | "ACTIONABILITY_MISSING"
  | "DUPLICATE_OPPORTUNITY"
  | "HTML_LEAKAGE";

export type ReportQualityBlockingReason = {
  code: ReportQualityBlockingCode;
  message: string;
  opportunityIndexes: number[];
};

export type ReportQualityOpportunityResult = {
  index: number;
  title: string;
  passed: boolean;
  requirements: Record<ReportQualityRequirement, boolean>;
};

export type ReportQualityMetrics = {
  tier: ReportQualityTier;
  opportunityCount: number;
  minimumOpportunityCount: number;
  qualifyingOpportunityCount: number;
  minimumQualifyingOpportunityCount: number;
  requirementPassCounts: Record<ReportQualityRequirement, number>;
  requirementCoverage: Record<ReportQualityRequirement, number>;
};

export type ReportQualityEvaluation = {
  passed: boolean;
  score: number;
  blockingReasons: ReportQualityBlockingReason[];
  metrics: ReportQualityMetrics;
  opportunities: ReportQualityOpportunityResult[];
};

const REQUIREMENTS: readonly ReportQualityRequirement[] = [
  "companyCorrectEvidence",
  "validSourceUrl",
  "concreteTargetOrganization",
  "validRevenueMotion",
  "nextActionAndContactPath",
  "actionability",
  "uniqueOpportunity",
  "noHtmlLeakage"
];

const MINIMUM_OPPORTUNITIES: Record<ReportQualityTier, number> = {
  preview: 2,
  full: 3
};

const REVENUE_MOTIONS = new Set([
  "direct apply",
  "sell to agency",
  "sell to funded buyer",
  "sell to award recipient",
  "sell to grantee",
  "partner with recipient",
  "channel distributor motion",
  "build channel campaign",
  "monitor policy",
  "research only",
  "procurement bid",
  "reimbursement strategy"
]);

const CONTACT_STRATEGIES = new Set<NormalizedOpportunityAction["contact_strategy"]>([
  "use_source_native_contact",
  "inspect_procurement_record",
  "contact_procurement_office",
  "contact_program_office",
  "contact_grants_manager",
  "contact_award_recipient",
  "research_prime_or_vendor",
  "identify_distributor",
  "enrich_company_domain",
  "monitor_source",
  "create_manual_research_task"
]);

const PROFILE_STOP_WORDS = new Set([
  "about",
  "agency",
  "and",
  "business",
  "buyer",
  "company",
  "contract",
  "federal",
  "for",
  "funded",
  "funding",
  "government",
  "grant",
  "industry",
  "opportunities",
  "opportunity",
  "partner",
  "procurement",
  "program",
  "public",
  "sector",
  "service",
  "services",
  "state",
  "support",
  "target",
  "the",
  "with"
]);

const HTML_PATTERN = /<\/?[a-z][^>]*>|<!doctype\s+html|&lt;\/?[a-z][^&]*&gt;/i;
const GENERIC_TARGET_PATTERN = /^(?:n\/?a|none|unknown|tbd|needs? review|the target organization|public agency|agency|funder|program office|procurement office|eligible applicants?(?: or future (?:award )?recipients?)?|future (?:award )?recipients?|award recipients?|funded buyers?|research target)$/i;

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !PROFILE_STOP_WORDS.has(word));
}

function profileConcepts(profile: CompanyProfile): string[][] {
  const values = [
    ...(profile.products_services ?? []),
    ...(profile.inferred_products_services ?? []),
    ...(profile.target_customers ?? []),
    ...(profile.inferred_target_customers ?? []),
    ...(profile.industries ?? []),
    ...(profile.keywords ?? []),
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.translated_public_sector_terms ?? []),
    ...(profile.include_terms ?? []),
    ...(profile.good_fit_examples ?? []),
    ...(profile.confirmed_opportunity_lanes ?? []),
    ...(profile.opportunity_lanes ?? [])
  ];

  const seen = new Set<string>();
  return values.flatMap((value) => {
    const words = [...new Set(normalizedWords(value))];
    const key = words.join(" ");
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [words];
  });
}

function sourceEvidenceText(opportunity: OpportunitySignal): string {
  return [
    opportunity.external_evidence_summary,
    opportunity.agency_or_funder,
    opportunity.likely_buyer_or_partner
  ].join(" ");
}

function hasCompanyCorrectEvidence(opportunity: OpportunitySignal, concepts: string[][]): boolean {
  const evidenceWords = new Set(normalizedWords(sourceEvidenceText(opportunity)));
  if (evidenceWords.size === 0) return false;

  if (concepts.some((concept) => concept.length >= 2 && concept.every((word) => evidenceWords.has(word)))) {
    return true;
  }

  const profileWords = new Set(concepts.flat());
  let overlap = 0;
  for (const word of profileWords) {
    if (evidenceWords.has(word)) overlap += 1;
    if (overlap >= 2) return true;
  }
  return false;
}

function hasValidSourceUrl(value: string): boolean {
  try {
    const url = parseOutboundUrl(value);
    return Boolean(url.hostname.includes(".") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname));
  } catch {
    return false;
  }
}

function actionFor(opportunity: OpportunitySignal): Partial<NormalizedOpportunityAction> {
  return opportunity.normalized_action ?? {
    revenue_motion: opportunity.revenue_motion,
    target_organization: opportunity.target_organization,
    actionability_score: opportunity.actionability_score,
    actionability_label: opportunity.actionability_label,
    show_in_report: opportunity.show_in_report,
    next_best_action: opportunity.next_best_action,
    contact_strategy: opportunity.contact_strategy,
    recommended_contact_roles: opportunity.recommended_contact_roles
  };
}

function concreteTargetOrganization(opportunity: OpportunitySignal, action: Partial<NormalizedOpportunityAction>): boolean {
  const target = (action.target_organization || opportunity.likely_buyer_or_partner || "").trim();
  return target.length >= 4 && !GENERIC_TARGET_PATTERN.test(target) && target.toLowerCase() !== opportunity.opportunity_title.toLowerCase();
}

function normalizeCategory(value: string): string {
  return value.toLowerCase().replace(/[_/&-]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function validRevenueMotion(action: Partial<NormalizedOpportunityAction>): boolean {
  return typeof action.revenue_motion === "string" && REVENUE_MOTIONS.has(normalizeCategory(action.revenue_motion));
}

function hasNextActionAndContactPath(action: Partial<NormalizedOpportunityAction>): boolean {
  const nextAction = action.next_best_action?.trim() ?? "";
  return nextAction.length >= 12 && Boolean(action.contact_strategy && CONTACT_STRATEGIES.has(action.contact_strategy));
}

function hasActionability(action: Partial<NormalizedOpportunityAction>): boolean {
  const score = action.actionability_score;
  return (
    action.show_in_report === true &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 100 &&
    (action.actionability_label === "Strong" ||
      action.actionability_label === "Medium" ||
      action.actionability_label === "Research")
  );
}

function displayedStrings(opportunity: OpportunitySignal, action: Partial<NormalizedOpportunityAction>): string[] {
  return [
    opportunity.opportunity_title,
    opportunity.source_name,
    opportunity.agency_or_funder,
    opportunity.external_evidence_summary,
    opportunity.why_it_matters,
    opportunity.who_benefits,
    opportunity.likely_buyer_or_partner,
    opportunity.recommended_action,
    opportunity.actionability_reason,
    opportunity.best_next_step,
    action.target_organization,
    action.source_status,
    action.next_best_action,
    action.screening_path,
    action.screening_reason,
    action.manual_research_instruction,
    action.crm_note,
    action.outreach_angle,
    action.follow_up_task,
    ...(action.recommended_contact_roles ?? [])
  ].filter((value): value is string => typeof value === "string");
}

function duplicateIndexes(opportunities: readonly OpportunitySignal[]): Set<number> {
  const groups = new Map<string, number[]>();
  opportunities.forEach((opportunity, index) => {
    const action = actionFor(opportunity);
    const title = normalizeCategory(opportunity.opportunity_title);
    const target = normalizeCategory(action.target_organization || opportunity.likely_buyer_or_partner || "");
    const key = `${title}|${target}`;
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  });

  const duplicates = new Set<number>();
  for (const indexes of groups.values()) {
    if (indexes.length > 1) indexes.forEach((index) => duplicates.add(index));
  }
  return duplicates;
}

const BLOCKING_DETAILS: Record<ReportQualityRequirement, { code: ReportQualityBlockingCode; message: string }> = {
  companyCorrectEvidence: {
    code: "COMPANY_EVIDENCE_MISSING",
    message: "Every opportunity needs source evidence that matches the company's products, services, customers, or opportunity lanes."
  },
  validSourceUrl: {
    code: "INVALID_SOURCE_URL",
    message: "Every opportunity needs a valid public HTTP or HTTPS source URL."
  },
  concreteTargetOrganization: {
    code: "TARGET_ORGANIZATION_MISSING",
    message: "Every opportunity needs a concrete target organization, not a generic buyer or recipient placeholder."
  },
  validRevenueMotion: {
    code: "REVENUE_MOTION_MISSING",
    message: "Every opportunity needs a recognized revenue motion."
  },
  nextActionAndContactPath: {
    code: "NEXT_ACTION_OR_CONTACT_PATH_MISSING",
    message: "Every opportunity needs both a concrete next action and a recognized contact path."
  },
  actionability: {
    code: "ACTIONABILITY_MISSING",
    message: "Every opportunity must be reportable and include a valid actionability score and label."
  },
  uniqueOpportunity: {
    code: "DUPLICATE_OPPORTUNITY",
    message: "Every opportunity must be unique by normalized title and target organization."
  },
  noHtmlLeakage: {
    code: "HTML_LEAKAGE",
    message: "Report-facing opportunity fields must not contain raw or encoded HTML."
  }
};

export function evaluateReportQuality(
  profile: CompanyProfile,
  opportunities: readonly OpportunitySignal[],
  tier: ReportQualityTier = "preview"
): ReportQualityEvaluation {
  const minimumOpportunityCount = MINIMUM_OPPORTUNITIES[tier];
  const concepts = profileConcepts(profile);
  const duplicates = duplicateIndexes(opportunities);

  const opportunityResults = opportunities.map((opportunity, index): ReportQualityOpportunityResult => {
    const action = actionFor(opportunity);
    const requirements: Record<ReportQualityRequirement, boolean> = {
      companyCorrectEvidence: hasCompanyCorrectEvidence(opportunity, concepts),
      validSourceUrl: hasValidSourceUrl(opportunity.source_url),
      concreteTargetOrganization: concreteTargetOrganization(opportunity, action),
      validRevenueMotion: validRevenueMotion(action),
      nextActionAndContactPath: hasNextActionAndContactPath(action),
      actionability: hasActionability(action),
      uniqueOpportunity: !duplicates.has(index),
      noHtmlLeakage: !displayedStrings(opportunity, action).some((value) => HTML_PATTERN.test(value))
    };

    return {
      index,
      title: opportunity.opportunity_title,
      passed: REQUIREMENTS.every((requirement) => requirements[requirement]),
      requirements
    };
  });

  const requirementPassCounts = Object.fromEntries(
    REQUIREMENTS.map((requirement) => [
      requirement,
      opportunityResults.filter((result) => result.requirements[requirement]).length
    ])
  ) as Record<ReportQualityRequirement, number>;
  const requirementCoverage = Object.fromEntries(
    REQUIREMENTS.map((requirement) => [
      requirement,
      opportunities.length === 0 ? 0 : requirementPassCounts[requirement] / opportunities.length
    ])
  ) as Record<ReportQualityRequirement, number>;
  const qualifyingOpportunityCount = opportunityResults.filter((result) => result.passed).length;

  const blockingReasons: ReportQualityBlockingReason[] = [];
  if (concepts.length < 2) {
    blockingReasons.push({
      code: "PROFILE_CONTEXT_INSUFFICIENT",
      message: "The company profile needs clearer product, customer, industry, or opportunity-lane context before report publication.",
      opportunityIndexes: []
    });
  }
  if (
    typeof profile.profile_confidence_score === "number" &&
    Number.isFinite(profile.profile_confidence_score) &&
    profile.profile_confidence_score < 55
  ) {
    blockingReasons.push({
      code: "PROFILE_CONFIDENCE_LOW",
      message: "The inferred company profile confidence is too low for automatic report publication.",
      opportunityIndexes: []
    });
  }
  if (opportunities.length < minimumOpportunityCount) {
    blockingReasons.push({
      code: "INSUFFICIENT_OPPORTUNITIES",
      message: `${tier === "preview" ? "Preview/free" : "Paid/full"} reports require at least ${minimumOpportunityCount} opportunities.`,
      opportunityIndexes: []
    });
  }
  if (qualifyingOpportunityCount < minimumOpportunityCount) {
    blockingReasons.push({
      code: "INSUFFICIENT_QUALIFYING_OPPORTUNITIES",
      message: `${tier === "preview" ? "Preview/free" : "Paid/full"} reports require at least ${minimumOpportunityCount} opportunities that pass every quality requirement.`,
      opportunityIndexes: opportunityResults.filter((result) => !result.passed).map((result) => result.index)
    });
  }
  for (const requirement of REQUIREMENTS) {
    const failedIndexes = opportunityResults
      .filter((result) => !result.requirements[requirement])
      .map((result) => result.index);
    if (failedIndexes.length > 0) {
      const detail = BLOCKING_DETAILS[requirement];
      blockingReasons.push({ ...detail, opportunityIndexes: failedIndexes });
    }
  }

  const countCoverage = Math.min(1, opportunities.length / minimumOpportunityCount);
  const requirementScore = REQUIREMENTS.reduce((sum, requirement) => sum + requirementCoverage[requirement], 0);
  const score = Math.round(((countCoverage + requirementScore) / (REQUIREMENTS.length + 1)) * 100);

  return {
    passed: blockingReasons.length === 0,
    score,
    blockingReasons,
    metrics: {
      tier,
      opportunityCount: opportunities.length,
      minimumOpportunityCount,
      qualifyingOpportunityCount,
      minimumQualifyingOpportunityCount: minimumOpportunityCount,
      requirementPassCounts,
      requirementCoverage
    },
    opportunities: opportunityResults
  };
}
