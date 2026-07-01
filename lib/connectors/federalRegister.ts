import { CompanyProfile, OpportunitySignal } from "../types";
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

type FederalRegisterDocument = {
  title?: string;
  abstract?: string;
  html_url?: string;
  publication_date?: string;
  type?: string;
  agencies?: Array<{ name?: string }>;
};

const relevanceWords = [
  "music",
  "artist",
  "arts",
  "cultural",
  "creative",
  "performing arts",
  "live entertainment",
  "event production",
  "concert",
  "festival",
  "medical",
  "health",
  "medicare",
  "medicaid",
  "rehab",
  "rehabilitation",
  "veteran",
  "disability",
  "pain",
  "patient",
  "orthotic",
  "prosthetic",
  "worker",
  "occupational",
  "injury",
  "public safety",
  "sports",
  "athletic"
];

function isCreativeProfile(profile: CompanyProfile): boolean {
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

  return /music|musician|artist|artists|creative|entertainment|performing arts|live event|cultural|venue|festival|concert/.test(
    text
  );
}

function isRelevantDocument(doc: FederalRegisterDocument, query: string, profile: CompanyProfile): boolean {
  const text = `${doc.title ?? ""} ${doc.abstract ?? ""} ${doc.agencies
    ?.map((item) => item.name)
    .join(" ") ?? ""}`.toLowerCase();
  if (hasNegativeEvidence(text) || hasProfileNegativeEvidence(profile, text) || !hasStrongEvidence(text)) {
    return false;
  }

  if (isCreativeProfile(profile)) {
    const hasCreativeFit = /music|musician|artist|artists|arts|cultural|creative|performing arts|live entertainment|event production|concert|festival|public arts|national endowment for the arts|national foundation on the arts and the humanities|smithsonian/.test(
      text
    );
    const wrongDomain = /medicare|medicaid|cms|hospital|healthcare|clinical|patient|transplant|behavioral health|mental health/.test(
      text
    );

    return hasCreativeFit && !wrongDomain;
  }

  const hasRelevantWord = relevanceWords.some((word) => text.includes(word));
  const hasQueryWord = query
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.length > 4 && text.includes(word));
  const hasAgencyFit = /health|medicare|medicaid|veteran|labor|occupational safety|cms/.test(text);

  return hasRelevantWord && hasQueryWord && hasAgencyFit;
}

async function searchDocuments(query: string): Promise<FederalRegisterDocument[]> {
  const params = new URLSearchParams({
    "conditions[term]": query,
    "conditions[publication_date][gte]": "2023-01-01",
    "order": "newest",
    "per_page": "3"
  });

  const response = await fetch(`https://www.federalregister.gov/api/v1/documents.json?${params}`);
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data?.results ?? []) as FederalRegisterDocument[];
}

export async function searchFederalRegister(profile: CompanyProfile): Promise<OpportunitySignal[]> {
  const terms = collectSearchTerms(profile, 8);
  const signals: OpportunitySignal[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const docs = await searchDocuments(term);

    for (const doc of docs) {
      if (!isRelevantDocument(doc, term, profile)) {
        continue;
      }
      const url = doc.html_url ?? "https://www.federalregister.gov/documents/search";
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);

      const agency = doc.agencies?.map((item) => item.name).filter(Boolean).join(", ") ?? "";
      const summary = doc.abstract || doc.title || "Federal Register document matched this search term.";
      const text = evidenceText(term, doc.title, summary, agency, doc.type);
      const relevanceScore = evidenceScore(text, term);
      const lane = inferSignalLane(text, "Policy and regulatory demand signal");

      signals.push({
        opportunity_title: doc.title ?? `Federal Register policy signal for ${term}`,
        source_type: "policy_signal",
        source_name: "Federal Register",
        source_url: url,
        agency_or_funder: agency,
        deadline: "",
        geography: "Federal",
        external_evidence_summary: summary,
        why_it_matters:
          "Federal Register activity can signal agency priorities, regulatory changes, program design, or future demand before a procurement or grant is obvious.",
        who_benefits: "Companies monitoring policy-created demand",
        likely_buyer_or_partner: agency,
        revenue_pathway: "monitor_policy",
        relevance_score: relevanceScore,
        novelty_score: clampScore(70 + (relevanceScore > 70 ? 8 : 0)),
        confidence_score: clampScore(50 + (agency ? 10 : 0) + (summary.toLowerCase().includes(term.toLowerCase()) ? 10 : 0)),
        reasoning: [
          `Matched search term: ${term}`,
          `Inferred lane: ${lane}`,
          `Document type: ${doc.type ?? "Federal Register document"}`,
          "Treat as a demand signal, not a direct buying opportunity."
        ],
        recommended_action: `Review this under the "${lane}" pathway and decide whether it implies future procurement, reimbursement, compliance, or partner demand.`,
        actionability: "unlikely",
        actionability_reason:
          "Policy activity can explain demand but is not enough by itself to recommend direct outreach.",
        best_next_step:
          "Use as context only unless paired with an active contract, grant, buyer, or specific agency program.",
        human_review_required: true,
        query_used: term,
        raw_json: doc as Record<string, unknown>
      });

      if (signals.length >= 6) {
        return signals;
      }
    }
  }

  return signals;
}
