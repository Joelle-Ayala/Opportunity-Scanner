import { CompanyProfile, OpportunitySignal } from "../types";
import {
  clampScore,
  collectSearchTerms,
  evidenceScore,
  evidenceText,
  hasNegativeEvidence,
  hasProfileNegativeEvidence,
  hasStrongEvidence,
  inferSignalLane,
  isInfrastructureSignal
} from "./shared";

type UsaAward = {
  "Award ID"?: string;
  internal_id?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number;
  "Start Date"?: string;
  "End Date"?: string;
  "Awarding Agency"?: string;
  Description?: string;
  "Award Type"?: string;
  "Place of Performance State Code"?: string;
};

function formatMoney(value?: number): string {
  if (!value) {
    return "undisclosed amount";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function awardUrl(award?: UsaAward): string {
  const awardId = award?.internal_id || award?.["Award ID"];
  if (!awardId) {
    return "https://www.usaspending.gov/search";
  }

  return `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}`;
}

function isEducationWorkforceProfile(profile: CompanyProfile): boolean {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.industries ?? []),
    ...(profile.keywords ?? []),
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return /schoolgig|teacher|teachers|educator|educators|substitute|teacher shortage|teacher recruitment|school staffing|school district hiring|hiring platform|recruiting|recruitment|job board|talent acquisition|applicant tracking/.test(
    text
  ) || /prop 28|proposition 28|arts education|music education|teaching artist|teaching artists|school arts|arts enrichment|vapa|visual and performing arts|artist educator/.test(
    text
  );
}

function isEducationWorkforceFit(text: string): boolean {
  return /teacher|teachers|educator|educators|principal|principals|substitute teacher|teacher shortage|teacher recruitment|teacher residency|school staffing|school workforce|school district recruiting|applicant tracking|human resources software|job board|talent acquisition|recruiting platform/.test(
    text
  ) || /prop 28|proposition 28|arts education|music education|teaching artist|teaching artists|school arts|arts enrichment|vapa|visual and performing arts|artist educator|expanded learning/.test(
    text
  );
}

function isEducationDomainMismatch(text: string): boolean {
  const healthOrCrisis = /behavioral health|mental health|suicide|988|crisis|clinical|clinician|therapist|medicaid|healthcare|department of health|substance use|telehealth/.test(
    text
  );
  const justiceOrReentry = /prison|jail|incarcerated|reentry|correctional|justice center|law enforcement custody/.test(
    text
  );

  return healthOrCrisis || justiceOrReentry;
}

function isCreativeWorkforceProfile(profile: CompanyProfile): boolean {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.industries ?? []),
    ...(profile.keywords ?? []),
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return /jammcard|music|musician|artist|artists|creative|entertainment|performing arts|live event|cultural|venue|production/.test(
    text
  );
}

function isCreativeWorkforceFit(text: string): boolean {
  return /music|musician|musicians|artist|artists|arts|creative economy|creative workforce|arts workforce|performing arts|live entertainment|event production|cultural programming|music education|public arts|festival|venue|musical performance|live music|performer services|performers|concert|event entertainment|public event|tourism/.test(
    text
  );
}

function isCreativeDomainMismatch(text: string): boolean {
  return /teacher shortage|teacher residency|school staffing|substitute teacher|educator workforce|student athlete|medical supplies|medicaid|medicare|behavioral health|mental health|correctional|reentry|environmental quality|environmental protection|water quality|air quality|artificial intelligence|collaborative research|intensive care|patient recovery|conference:|computation for music/.test(
    text
  );
}

function creativeLaneFor(text: string, fallback: string): string {
  if (/business improvement district|downtown partnership|downtown activation|public plaza|public space activation|open streets|night market|neighborhood festival/.test(text)) {
    return "Downtown revitalization / BID programming";
  }
  if (/teaching artist|arts education|music enrichment|school arts|artist residency/.test(text)) {
    return "School and district arts programming";
  }
  if (/creative workforce|arts workforce|artist services|creative economy/.test(text)) {
    return "Creative workforce development";
  }
  if (/tourism|placemaking|downtown activation|business improvement district/.test(text)) {
    return "Tourism and placemaking";
  }
  if (/concert|live music|musical performance|event entertainment|performer services|public event/.test(text)) {
    return "City and county live performance budgets";
  }
  if (/arts grant|cultural programming|performing arts|public arts/.test(text)) {
    return "Arts and culture grants";
  }
  return fallback;
}

const awardTypeGroups = [
  ["A", "B", "C", "D"],
  ["02", "03", "04", "05", "F001", "F002"]
];

const creativeHighIntentTerms = [
  "live music performance",
  "music performance",
  "musical performance",
  "musician services",
  "live music services",
  "event entertainment",
  "event entertainment services",
  "concert programming",
  "public concerts",
  "summer concert series",
  "festival entertainment",
  "performer services",
  "artist booking",
  "performing artist services",
  "live entertainment",
  "public event production",
  "business improvement district events",
  "public plaza programming",
  "public space activation",
  "downtown partnership events",
  "district event programming",
  "open streets programming",
  "night market entertainment",
  "neighborhood festival programming"
];

const educationHighIntentTerms = [
  "Prop 28 arts education",
  "Proposition 28 arts education",
  "arts education",
  "music education",
  "teaching artists",
  "school arts staffing",
  "arts enrichment",
  "artist educators",
  "California arts education",
  "teacher recruitment",
  "educator workforce",
  "school staffing",
  "school district hiring",
  "education recruitment platform"
];

function uniqueTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.filter(Boolean)));
}

async function searchAwards(query: string): Promise<UsaAward[]> {
  const endDate = new Date().toISOString().slice(0, 10);
  const awards: UsaAward[] = [];

  for (const awardTypeCodes of awardTypeGroups) {
    const response = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filters: {
          keywords: [query],
          award_type_codes: awardTypeCodes,
          time_period: [
            {
              start_date: "2024-01-01",
              end_date: endDate
            }
          ],
          award_amounts: [
            {
              lower_bound: 10000
            }
          ]
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Award Amount",
          "Start Date",
          "End Date",
          "Awarding Agency",
          "Description",
          "Award Type",
          "Place of Performance State Code"
        ],
        page: 1,
        limit: 3,
        sort: "Award Amount",
        order: "desc",
        subawards: false
      })
    });

    if (!response.ok) {
      continue;
    }

    const data = await response.json();
    awards.push(...((data?.results ?? []) as UsaAward[]));
  }

  return awards;
}

export async function searchUsaSpending(profile: CompanyProfile): Promise<OpportunitySignal[]> {
  const educationWorkforceProfile = isEducationWorkforceProfile(profile);
  const creativeWorkforceProfile = isCreativeWorkforceProfile(profile);
  const creativeOnlyProfile = creativeWorkforceProfile && !educationWorkforceProfile;
  const terms = creativeOnlyProfile
    ? uniqueTerms([...creativeHighIntentTerms, ...collectSearchTerms(profile, 40)]).slice(0, 45)
    : educationWorkforceProfile
    ? uniqueTerms([...educationHighIntentTerms, ...collectSearchTerms(profile, 36)]).slice(0, 40)
    : collectSearchTerms(profile, 18);
  const signals: OpportunitySignal[] = [];
  const seen = new Set<string>();
  const perQueryCount = new Map<string, number>();

  for (const term of terms) {
    const awards = await searchAwards(term);

    for (const award of awards) {
      const awardId = award["Award ID"] ?? `${term}-${award["Recipient Name"]}`;
      if (seen.has(awardId)) {
        continue;
      }
      if ((perQueryCount.get(term) ?? 0) >= 2) {
        continue;
      }
      seen.add(awardId);

      const amount = formatMoney(award["Award Amount"]);
      const recipient = award["Recipient Name"] ?? "Recipient not listed";
      const agency = award["Awarding Agency"] ?? "Agency not listed";
      const description = award.Description ?? "No description available.";
      const sourceText = evidenceText(recipient, agency, description, award["Award Type"]);
      const text = evidenceText(term, sourceText);
      if (!hasStrongEvidence(sourceText) || hasNegativeEvidence(sourceText) || hasProfileNegativeEvidence(profile, sourceText)) {
        continue;
      }
      if (
        educationWorkforceProfile &&
        (!isEducationWorkforceFit(sourceText) || isEducationDomainMismatch(sourceText))
      ) {
        continue;
      }
      if (
        creativeOnlyProfile &&
        (!isCreativeWorkforceFit(sourceText) || isCreativeDomainMismatch(sourceText))
      ) {
        continue;
      }
      const relevanceScore = isInfrastructureSignal(text)
        ? Math.min(evidenceScore(text, term), 64)
        : evidenceScore(text, term);
      const lane = isInfrastructureSignal(text)
        ? "DME, Medicare, and reimbursement infrastructure"
        : creativeOnlyProfile
        ? creativeLaneFor(text, inferSignalLane(text, "Public-sector funded-buyer signal"))
        : inferSignalLane(text, "Public-sector funded-buyer signal");
      const revenuePathway =
        isInfrastructureSignal(text)
          ? "monitor_policy"
          : text.includes("department of veterans affairs") ||
            text.includes("prosthetic") ||
            text.includes("orthotic") ||
            text.includes("school district")
          ? "sell_to_agency"
          : "sell_to_grantee";
      const infrastructure = isInfrastructureSignal(text);

      signals.push({
        opportunity_title: `${recipient} received ${amount}: ${lane}`,
        source_type: "historical_award",
        source_name: "USAspending.gov",
        source_url: awardUrl(award),
        agency_or_funder: agency,
        deadline: award["End Date"] ?? "",
        geography: award["Place of Performance State Code"] ?? "",
        external_evidence_summary: description,
        why_it_matters:
          "This is evidence that public money has flowed into an adjacent category, agency, or recipient market.",
        who_benefits: recipient,
        likely_buyer_or_partner: recipient,
        revenue_pathway: revenuePathway,
        relevance_score: relevanceScore,
        novelty_score: clampScore(64 + (relevanceScore > 70 ? 12 : 0)),
        confidence_score: clampScore(56 + (text.includes(term.toLowerCase()) ? 12 : 0) + (agency !== "Agency not listed" ? 8 : 0)),
        reasoning: [
          `Matched search term: ${term}`,
          `Inferred lane: ${lane}`,
          "USAspending records historical federal award activity.",
          "Treat as a funded-buyer or market-map signal, not proof of eligibility."
        ],
        recommended_action: isInfrastructureSignal(text)
          ? `Use this as reimbursement/procurement infrastructure context, not a near-term product buyer. Review ${agency} for DME policy and contractor ecosystem signals.`
          : `Review ${recipient} and ${agency} under the "${lane}" pathway; look for procurement contacts, grantee relationships, or similar buyers.`,
        actionability: infrastructure ? "unlikely" : "maybe",
        actionability_reason: infrastructure
          ? "Infrastructure or reimbursement-system context, not a direct buyer/channel the company can pursue."
          : "Adjacent public-sector spending that may indicate a buyer, partner, or funded-recipient pathway.",
        best_next_step: infrastructure
          ? "Do not surface as a lead; use only for background market mapping."
          : "Validate the buying office and determine whether outreach should go to the recipient, agency procurement contact, or channel partner.",
        human_review_required: true,
        query_used: term,
        raw_json: award as Record<string, unknown>
      });
      perQueryCount.set(term, (perQueryCount.get(term) ?? 0) + 1);

      if (signals.length >= (creativeOnlyProfile ? 28 : educationWorkforceProfile ? 24 : 14)) {
        return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
      }
    }
  }

  return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
}
