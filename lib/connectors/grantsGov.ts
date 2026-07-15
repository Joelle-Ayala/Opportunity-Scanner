import type { CompanyProfile, OpportunitySignal } from "../types";
import {
  clampScore,
  collectSearchTerms,
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

type GrantsSearchHit = {
  id?: string | number;
  number?: string;
  title?: string;
  agencyCode?: string;
  agencyName?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  docType?: string;
  alnist?: string[];
};

type GrantsOpportunityDetail = {
  id?: string | number;
  opportunityNumber?: string;
  opportunityTitle?: string;
  owningAgencyCode?: string;
  synopsis?: {
    agencyName?: string;
    agencyContactName?: string;
    agencyContactEmail?: string;
    agencyContactPhone?: string;
    agencyContactDesc?: string;
    synopsisDesc?: string;
    responseDateDesc?: string;
    postingDate?: string;
    awardCeiling?: string;
    awardFloor?: string;
    applicantTypes?: Array<{ id?: string; description?: string }>;
    fundingInstruments?: Array<{ id?: string; description?: string }>;
    fundingActivityCategories?: Array<{ id?: string; description?: string }>;
  };
  alns?: Array<{ alnNumber?: string; programTitle?: string }>;
};

const searchEndpoint = "https://api.grants.gov/v1/api/search2";
const fetchEndpoint = "https://api.grants.gov/v1/api/fetchOpportunity";

function isDirectApplicantFit(detail: GrantsOpportunityDetail): boolean {
  const applicantText = (detail.synopsis?.applicantTypes ?? [])
    .map((item) => item.description ?? "")
    .join(" ")
    .toLowerCase();

  return /small business|business|for profit|private institution|individual/.test(applicantText);
}

function isCreativeProfile(profile: CompanyProfile): boolean {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? []),
    ...(profile.keywords ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return /jammcard|music|musician|artist|arts|creative|entertainment|performing arts|concert|festival|cultural|event/.test(text);
}

function isEducationProfile(profile: CompanyProfile): boolean {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? []),
    ...(profile.keywords ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return /schoolgig|school|district|teacher|educator|education workforce|arts education|music education|teaching artist|teaching artists|prop 28|proposition 28|vapa|school arts|arts enrichment/.test(text);
}

function isEducationGrantFit(text: string): boolean {
  return /school|district|teacher|educator|education workforce|teacher recruitment|teacher residency|arts education|music education|teaching artist|teaching artists|school arts|arts enrichment|prop 28|proposition 28|vapa|visual and performing arts|expanded learning|artist educator/.test(text);
}

function isEducationGrantMismatch(text: string): boolean {
  return /embassy|public diplomacy|foreign|international exchange|brazil|algeria|canada|overseas|u\.s\. mission|english language overseas|stem in brazil|clinical|clinical trial|nih|national institutes of health|heart failure|infectious diseases|active shooter|shooter situations|research software engineer|health|healthcare|medical|patient|disease|diseases/.test(text);
}

function isCreativeGrantFit(text: string): boolean {
  return /\barts?\b|\bartists?\b|\bcreative\b|\bcultural\b|\bculture\b|\bmusic\b|\bmusicians?\b|performing arts|\bperformance\b|\bfestival\b|\bconcert\b|talent program|public diplomacy|cultural affairs|creative tech|nea grants/.test(text);
}

function isCreativeGrantMismatch(text: string): boolean {
  return /family planning|public health|health services|clinical trials|behavioral and social sciences|nih|national institutes of health|information and referral|qubit|autonomous maneuver|tactical behaviors|army|defense research|nasa|murep|sustainability and innovation collaborative/.test(text);
}

function isPastDeadline(deadline: string): boolean {
  const currentDate = new Date().toISOString().slice(0, 10);
  const match = deadline.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) {
    const year = deadline.match(/\b(20\d{2})\b/)?.[1];
    return Boolean(year && `${year}-12-31` < currentDate);
  }

  const [, month, day, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return iso < currentDate;
}

function formatAwardRange(detail: GrantsOpportunityDetail): string {
  const floor = detail.synopsis?.awardFloor;
  const ceiling = detail.synopsis?.awardCeiling;
  if (floor && ceiling) {
    return `Award range ${floor}-${ceiling}`;
  }
  if (ceiling) {
    return `Award ceiling ${ceiling}`;
  }
  return "";
}

function opportunityUrl(id?: string | number): string {
  if (!id) {
    return "https://www.grants.gov/search-grants";
  }

  return `https://www.grants.gov/search-results-detail/${encodeURIComponent(String(id))}`;
}

async function searchGrants(
  term: string,
  context: ConnectorExecutionContext
): Promise<GrantsSearchHit[]> {
  try {
    const data = await fetchConnectorJson<{ data?: { oppHits?: GrantsSearchHit[] } }>(
      context,
      "Grants.gov",
      searchEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: 5,
          keyword: term,
          oppStatuses: "forecasted|posted",
          eligibilities: "",
          agencies: "",
          aln: "",
          fundingCategories: ""
        })
      },
      term
    );
    return data.data?.oppHits ?? [];
  } catch {
    return [];
  }
}

async function fetchGrantOpportunity(
  id: string | number,
  term: string,
  context: ConnectorExecutionContext
): Promise<GrantsOpportunityDetail | null> {
  try {
    const data = await fetchConnectorJson<{ data?: GrantsOpportunityDetail }>(
      context,
      "Grants.gov",
      fetchEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: Number(id) })
      },
      term
    );
    return data.data ?? null;
  } catch {
    return null;
  }
}

export async function searchGrantsGov(
  profile: CompanyProfile,
  context: ConnectorExecutionContext
): Promise<OpportunitySignal[]> {
  const terms = collectSearchTerms(profile, 18);
  const creativeProfile = isCreativeProfile(profile);
  const educationProfile = isEducationProfile(profile);
  const creativeOnlyProfile = creativeProfile && !educationProfile;
  const signals: OpportunitySignal[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    if (connectorShouldStop(context)) break;
    const hits = await searchGrants(term, context);

    for (const hit of hits) {
      if (connectorShouldStop(context)) break;
      const id = hit.id;
      if (!id || seen.has(String(id))) {
        continue;
      }
      seen.add(String(id));

      const detail = await fetchGrantOpportunity(id, term, context);
      const synopsis = detail?.synopsis;
      const title = detail?.opportunityTitle || hit.title || "Untitled Grants.gov opportunity";
      const agency = synopsis?.agencyName || hit.agencyName || detail?.owningAgencyCode || hit.agencyCode || "Agency not listed";
      const description = synopsis?.synopsisDesc || title;
      const fundingCategories = (synopsis?.fundingActivityCategories ?? [])
        .map((item) => item.description)
        .filter(Boolean)
        .join(", ");
      const applicantTypes = (synopsis?.applicantTypes ?? [])
        .map((item) => item.description)
        .filter(Boolean)
        .join(", ");
      const awardRange = detail ? formatAwardRange(detail) : "";
      const sourceText = evidenceText(title, agency, description, fundingCategories, applicantTypes, awardRange);

      if (!hasStrongEvidence(sourceText) || hasNegativeEvidence(sourceText) || hasProfileNegativeEvidence(profile, sourceText)) {
        continue;
      }

      const relevanceScore = evidenceScore(sourceText, term);
      if (relevanceScore < 58) {
        continue;
      }

      const directApply = detail ? isDirectApplicantFit(detail) : false;
      const lane = inferSignalLane(sourceText, "Grant and funding opportunity");
      const contactName = synopsis?.agencyContactName || "";
      const contactEmail = synopsis?.agencyContactEmail || "";
      const contactPhone = synopsis?.agencyContactPhone || "";
      const deadline = hit.closeDate || synopsis?.responseDateDesc || "";
      if (deadline && isPastDeadline(deadline)) {
        continue;
      }
      if (educationProfile && (!isEducationGrantFit(sourceText) || isEducationGrantMismatch(sourceText))) {
        continue;
      }
      if (creativeOnlyProfile && (!isCreativeGrantFit(sourceText) || isCreativeGrantMismatch(sourceText))) {
        continue;
      }

      signals.push({
        opportunity_title: `Grants.gov ${hit.oppStatus || "opportunity"}: ${title}`,
        source_type: "active_grant",
        source_name: "Grants.gov",
        source_url: opportunityUrl(id),
        agency_or_funder: agency,
        deadline,
        geography: "Federal",
        external_evidence_summary: [description, awardRange, applicantTypes ? `Eligible applicants: ${applicantTypes}` : ""]
          .filter(Boolean)
          .join(" | "),
        why_it_matters: directApply
          ? "This is an active or forecasted grant opportunity where the company may be able to evaluate direct eligibility."
          : "This is an active or forecasted funding signal that may create funded buyer, grantee, partner, or program demand.",
        who_benefits: profile.company_name,
        likely_buyer_or_partner: directApply ? agency : "Eligible applicants or future award recipients",
        revenue_pathway: directApply ? "direct_apply" : "partner_with_recipient",
        relevance_score: relevanceScore,
        novelty_score: clampScore(74 + (hit.oppStatus === "forecasted" ? 8 : 0)),
        confidence_score: clampScore(66 + (deadline ? 8 : 0) + (contactEmail ? 6 : 0)),
        reasoning: [
          `Matched search term: ${term}`,
          `Inferred lane: ${lane}`,
          `Grants.gov status: ${hit.oppStatus || "Unknown"}`,
          directApply
            ? "Treat the agency contact as a program/eligibility contact."
            : "Treat this as a funded-buyer or partner signal; do not treat the grant contact as the sales buyer."
        ],
        recommended_action: directApply
          ? `Review eligibility and contact the Grants.gov program contact for fit under the "${lane}" pathway.`
          : `Track likely grantees and eligible applicants under the "${lane}" pathway; use the agency contact for program questions, not as the sales decision-maker.`,
        actionability: directApply && relevanceScore >= 70 ? "yes" : "maybe",
        actionability_reason: directApply
          ? "Active grant opportunity with an agency program contact; direct eligibility still needs validation."
          : "Active funding signal that may create downstream buyers or partners, but the sales path depends on identifying applicants or recipients.",
        best_next_step: contactEmail
          ? `Use the listed Grants.gov program contact for eligibility/program questions only: ${[contactName, contactEmail, contactPhone].filter(Boolean).join(" | ")}.`
          : "Review the grant and identify likely eligible applicants, future recipients, or program partners.",
        human_review_required: true,
        query_used: term,
        raw_json: {
          search_hit: hit,
          detail,
          source_contact_role: "grant_program_contact",
          pointOfContact: contactName || contactEmail || contactPhone
            ? [
                {
                  fullName: contactName,
                  title: "Grant Program Contact",
                  email: contactEmail,
                  phone: contactPhone
                }
              ]
            : []
        }
      });

      if (signals.length >= 10) {
        return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
      }
    }
  }

  return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
}
