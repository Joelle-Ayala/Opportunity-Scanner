import { CompanyProfile, OpportunitySignal } from "../types";
import {
  clampScore,
  evidenceScore,
  evidenceText,
  hasNegativeEvidence,
  hasProfileNegativeEvidence,
  hasStrongEvidence,
  inferSignalLane
} from "./shared";
import {
  connectorShouldStop,
  fetchConnectorJson,
  type ConnectorExecutionContext
} from "./runtime";

type SamOpportunity = {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  department?: string;
  subTier?: string;
  office?: string;
  postedDate?: string;
  type?: string;
  baseType?: string;
  responseDeadLine?: string;
  active?: string;
  naicsCode?: string;
  classificationCode?: string;
  typeOfSetAsideDescription?: string;
  description?: string;
  uiLink?: string;
  placeOfPerformance?: {
    city?: { name?: string };
    state?: { code?: string; name?: string };
  } | null;
  pointOfContact?: Array<{
    email?: string;
    phone?: string;
    title?: string;
    fullName?: string;
    fullname?: string;
  }> | null;
  award?: {
    amount?: string | number;
    date?: string;
    awardee?: { name?: string };
  } | null;
};

const samEndpoint = "https://api.sam.gov/opportunities/v2/search";
const activeProcurementTypes = ["o", "k", "r", "s", "p"];
const awardProcurementTypes = ["a"];
const genericSamTerms = new Set([
  "apply",
  "best",
  "blog",
  "contract opportunities",
  "county procurement",
  "https",
  "local government",
  "login",
  "membership",
  "procurement",
  "profile",
  "service",
  "state grants",
  "state procurement",
  "terms",
  "title",
  "website"
]);

const highIntentSamWords = [
  "applicant tracking",
  "artist booking",
  "bracing",
  "concert",
  "contract",
  "dme",
  "education workforce",
  "entertainment",
  "event",
  "festival",
  "hiring",
  "live music",
  "medical supplies",
  "music",
  "orthotic",
  "performer",
  "prosthetic",
  "recruitment",
  "school staffing",
  "services",
  "solicitation",
  "teacher",
  "vendor",
  "workforce"
];

export function isSamGovConfigured(): boolean {
  return Boolean(process.env.SAM_API_KEY);
}

function formatSamDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function oneYearAgo(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  date.setDate(date.getDate() + 1);
  return date;
}

function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/\s+/g, " ").trim();
}

function isUsefulSamTerm(term: string): boolean {
  const normalized = normalizeTerm(term);
  if (normalized.length < 5 || genericSamTerms.has(normalized)) {
    return false;
  }

  const wordCount = normalized.split(" ").length;
  const hasHighIntentWord = highIntentSamWords.some((word) => normalized.includes(word));
  return wordCount >= 2 || hasHighIntentWord;
}

function collectSamSearchTerms(profile: CompanyProfile, limit = 16): string[] {
  const terms = new Set<string>();

  for (const lane of profile.opportunity_lanes ?? []) {
    for (const term of profile.lane_search_terms?.[lane] ?? []) {
      if (isUsefulSamTerm(term)) {
        terms.add(term);
      }
    }
  }

  for (const term of profile.public_sector_search_terms ?? []) {
    if (isUsefulSamTerm(term)) {
      terms.add(term);
    }
  }

  const sorted = Array.from(terms).sort((a, b) => {
    const aScore = highIntentSamWords.filter((word) => normalizeTerm(a).includes(word)).length;
    const bScore = highIntentSamWords.filter((word) => normalizeTerm(b).includes(word)).length;
    return bScore - aScore || a.length - b.length;
  });

  return sorted.slice(0, limit);
}

function opportunityUrl(item: SamOpportunity): string {
  if (item.uiLink && item.uiLink !== "null") {
    return item.uiLink;
  }
  if (item.noticeId) {
    return `https://sam.gov/opp/${encodeURIComponent(item.noticeId)}/view`;
  }
  return "https://sam.gov/content/opportunities";
}

function agencyName(item: SamOpportunity): string {
  return (
    item.fullParentPathName ||
    [item.department, item.subTier, item.office].filter(Boolean).join(" / ") ||
    "Agency not listed"
  );
}

function geography(item: SamOpportunity): string {
  return item.placeOfPerformance?.state?.code || item.placeOfPerformance?.state?.name || "Federal";
}

function primaryContact(item: SamOpportunity): string {
  const contact = item.pointOfContact?.[0];
  if (!contact) {
    return "";
  }

  return [
    contact.title,
    contact.fullName || contact.fullname,
    contact.email,
    contact.phone
  ]
    .filter(Boolean)
    .join(" | ");
}

function procurementSourceType(item: SamOpportunity): OpportunitySignal["source_type"] {
  const type = `${item.type ?? ""} ${item.baseType ?? ""}`.toLowerCase();
  if (type.includes("award")) {
    return "funded_buyer";
  }
  if (type.includes("sources sought") || type.includes("special notice")) {
    return "procurement_category";
  }
  return "active_contract";
}

function revenuePathwayFor(item: SamOpportunity): OpportunitySignal["revenue_pathway"] {
  const type = `${item.type ?? ""} ${item.baseType ?? ""}`.toLowerCase();
  if (type.includes("sources sought") || type.includes("special notice")) {
    return "sell_to_agency";
  }
  if (type.includes("award")) {
    return "sell_to_grantee";
  }
  return "procurement_bid";
}

function titleFor(item: SamOpportunity, lane: string): string {
  const type = item.type || item.baseType || "SAM.gov opportunity";
  const title = item.title || "Untitled SAM.gov opportunity";
  return `${type}: ${title} (${lane})`;
}

async function searchSam(
  term: string,
  ptypes: string[],
  context: ConnectorExecutionContext
): Promise<SamOpportunity[]> {
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) {
    return [];
  }

  const results: SamOpportunity[] = [];

  for (const ptype of ptypes) {
    if (connectorShouldStop(context)) break;
    const params = new URLSearchParams({
      api_key: apiKey,
      postedFrom: formatSamDate(oneYearAgo()),
      postedTo: formatSamDate(new Date()),
      title: term,
      limit: "5",
      offset: "0",
      ptype
    });

    try {
      const data = await fetchConnectorJson<{ opportunitiesData?: SamOpportunity[] }>(
        context,
        "SAM.gov",
        `${samEndpoint}?${params}`,
        {},
        term
      );
      results.push(...(data.opportunitiesData ?? []));
    } catch {
      // Keep other notice types available and let runtime diagnostics decide
      // whether this was a partial or total connector failure.
    }
  }

  return results;
}

export async function searchSamGov(
  profile: CompanyProfile,
  context: ConnectorExecutionContext
): Promise<OpportunitySignal[]> {
  if (!isSamGovConfigured()) {
    return [];
  }

  const terms = collectSamSearchTerms(profile, 18);
  const signals: OpportunitySignal[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    if (connectorShouldStop(context)) break;
    const opportunities = [
      ...(await searchSam(term, activeProcurementTypes, context)),
      ...(await searchSam(term, awardProcurementTypes, context))
    ];

    for (const item of opportunities) {
      const id = item.noticeId || item.solicitationNumber || `${term}-${item.title}`;
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);

      const agency = agencyName(item);
      const contact = primaryContact(item);
      const summary = [
        item.title,
        item.type,
        item.baseType,
        item.typeOfSetAsideDescription,
        item.naicsCode ? `NAICS ${item.naicsCode}` : "",
        item.classificationCode ? `PSC ${item.classificationCode}` : "",
        item.responseDeadLine ? `Response deadline ${item.responseDeadLine}` : "",
        contact ? `Contact ${contact}` : ""
      ]
        .filter(Boolean)
        .join(" | ");
      const text = evidenceText(term, summary, agency);

      if (!hasStrongEvidence(text) || hasNegativeEvidence(text) || hasProfileNegativeEvidence(profile, text)) {
        continue;
      }

      const relevanceScore = evidenceScore(text, term);
      if (relevanceScore < 58) {
        continue;
      }

      const lane = inferSignalLane(text, "Active public procurement opportunity");
      const sourceType = procurementSourceType(item);
      const isActive = item.active === "Yes";
      const responseDeadline = item.responseDeadLine || "";
      const isBidLike = sourceType === "active_contract" || sourceType === "procurement_category";

      signals.push({
        opportunity_title: titleFor(item, lane),
        source_type: sourceType,
        source_name: "SAM.gov",
        source_url: opportunityUrl(item),
        agency_or_funder: agency,
        deadline: responseDeadline,
        geography: geography(item),
        external_evidence_summary:
          summary || "SAM.gov opportunity matched this public-sector search strategy.",
        why_it_matters:
          isBidLike
            ? "SAM.gov is an active procurement source, so this may represent a near-term bid or buying-office pathway."
            : "SAM.gov activity can reveal current procurement demand, award patterns, sources sought notices, or market research.",
        who_benefits: profile.company_name,
        likely_buyer_or_partner: agency,
        revenue_pathway: revenuePathwayFor(item),
        relevance_score: relevanceScore,
        novelty_score: clampScore(72 + (sourceType === "active_contract" ? 10 : 0)),
        confidence_score: clampScore(62 + (isActive ? 10 : 0) + (responseDeadline ? 8 : 0) + (contact ? 4 : 0)),
        reasoning: [
          `Matched search term: ${term}`,
          `Inferred lane: ${lane}`,
          `SAM.gov notice type: ${item.type || item.baseType || "Opportunity"}`,
          `SAM.gov active flag: ${item.active || "Unknown"}`,
          "Treat active solicitations and sources-sought notices as buyer/procurement pathways."
        ],
        recommended_action:
          isBidLike
            ? `Review the SAM.gov notice and validate whether the company can bid directly, partner, or contact the buying office under the "${lane}" pathway.`
            : `Use this SAM.gov notice to identify the buying office, funded buyer, or similar active procurement pattern under the "${lane}" pathway.`,
        actionability: isActive && isBidLike && relevanceScore >= 70 ? "yes" : "maybe",
        actionability_reason:
          isActive && isBidLike && relevanceScore >= 70
            ? "Active or recent SAM.gov procurement activity in an adjacent category."
            : "SAM.gov procurement activity may indicate buyer demand, but fit and eligibility need validation.",
        best_next_step:
          contact
            ? `Open the SAM.gov notice, review deadline/eligibility, then validate the listed contact: ${contact}.`
            : "Open the SAM.gov notice, review deadline/eligibility, and identify the contracting officer or program office.",
        human_review_required: true,
        query_used: term,
        raw_json: { ...item, sam_query_terms: terms } as Record<string, unknown>
      });

      if (signals.length >= 12) {
        return signals.sort(
          (a, b) =>
            b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score)
        );
      }
    }
  }

  return signals.sort(
    (a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score)
  );
}
