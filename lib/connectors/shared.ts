import { CompanyProfile, OpportunitySignal } from "../types";

const strongEvidenceTerms = [
  "education",
  "school",
  "schools",
  "school district",
  "district",
  "prop 28",
  "proposition 28",
  "arts education",
  "teaching artist",
  "teaching artists",
  "school arts",
  "arts enrichment",
  "vapa",
  "visual and performing arts",
  "teacher",
  "teachers",
  "educator",
  "educators",
  "substitute teacher",
  "teacher shortage",
  "teacher residency",
  "recruitment",
  "recruiting",
  "hiring",
  "staffing",
  "workforce development",
  "education technology",
  "applicant tracking",
  "human resources",
  "job board",
  "talent acquisition",
  "music",
  "musician",
  "musicians",
  "artist",
  "artists",
  "arts",
  "cultural",
  "creative economy",
  "creative workforce",
  "arts workforce",
  "performing arts",
  "live entertainment",
  "event production",
  "cultural programming",
  "music education",
  "musical performance",
  "live music",
  "performer services",
  "performers",
  "concert",
  "concert programming",
  "festival entertainment",
  "event entertainment",
  "public event",
  "venue entertainment",
  "tourism",
  "medical",
  "patient",
  "clinical",
  "rehabilitation",
  "orthotic",
  "orthotics",
  "prosthetic",
  "prosthetics",
  "durable medical equipment",
  "dme",
  "dmepos",
  "physical therapy",
  "occupational therapy",
  "veteran",
  "veterans",
  "va ",
  "workers compensation",
  "occupational health",
  "injury",
  "injuries",
  "pain",
  "medicaid",
  "medicare",
  "disability",
  "aging",
  "public safety",
  "first responder",
  "athletic",
  "sports medicine"
  ,"supplier",
  "supplies",
  "supply",
  "distribution",
  "distributor",
  "vendor",
  "laboratories",
  "medical retail",
  "compression garment",
  "bracing"
];

const negativeEvidenceTerms = [
  "marine mammal",
  "wildlife",
  "endangered",
  "grazing",
  "forest",
  "habitat",
  "fishery",
  "agriculture",
  "livestock",
  "environmental remediation",
  "paperwork reduction",
  "information collection",
  "omb review",
  "statement of organization, functions, and delegations of authority",
  "delegations of authority",
  "functions, and delegations",
  "recognition of testing laboratory",
  "grant of expansion of recognition",
  "national science foundation",
  "university",
  "project summary",
  "fitbit",
  "radar",
  "chairs",
  "furniture",
  "case management",
  "research and training",
  "grantmaker",
  "inflation reduction act",
  "industrial base expansion",
  "environmental quality",
  "environmental protection",
  "water quality",
  "air quality"
];

const infrastructureTerms = [
  "software services",
  "computer software",
  "system maintenance",
  "maintenance, developmental enhancements",
  "improper payment",
  "administrative contractor",
  "claims processing",
  "appeals workload",
  "qualified independent contractor",
  "improper payment rates",
  "medicare ffs",
  "bidding system",
  "dbids"
];

const laneMatchers: Array<{ lane: string; terms: string[] }> = [
  {
    lane: "California Prop 28 arts education funding",
    terms: [
      "prop 28",
      "proposition 28"
    ]
  },
  {
    lane: "Arts education and teaching artist staffing",
    terms: [
      "arts education",
      "teaching artist",
      "teaching artists",
      "school arts",
      "arts enrichment",
      "vapa",
      "visual and performing arts",
      "artist educator"
    ]
  },
  {
    lane: "City, state, and public venue entertainment procurement",
    terms: [
      "musical performance",
      "live music",
      "event entertainment",
      "festival entertainment",
      "concert programming",
      "performer services",
      "public event production",
      "venue entertainment"
    ]
  },
  {
    lane: "Creative workforce and music-industry talent networks",
    terms: [
      "creative economy workforce",
      "arts workforce",
      "music workforce",
      "artist services",
      "creative workforce",
      "entertainment workforce"
    ]
  },
  {
    lane: "Cultural programming, live events, and public arts buyers",
    terms: [
      "cultural programming",
      "performing arts",
      "music education",
      "public arts program",
      "live entertainment",
      "event production",
      "arts grants"
    ]
  },
  {
    lane: "K-12 hiring, teacher staffing, and educator workforce",
    terms: [
      "teacher",
      "teachers",
      "educator",
      "school district",
      "substitute teacher",
      "teacher shortage",
      "school staffing"
    ]
  },
  {
    lane: "Education workforce grants and technical assistance",
    terms: [
      "education workforce",
      "teacher residency",
      "educator preparation",
      "school improvement",
      "state education agency"
    ]
  },
  {
    lane: "Government HR, job board, and recruiting technology procurement",
    terms: [
      "recruiting software",
      "applicant tracking",
      "human resources",
      "job board",
      "talent acquisition",
      "recruitment platform"
    ]
  },
  {
    lane: "VA, prosthetics, and orthotics purchasing",
    terms: ["veteran", "veterans", "department of veterans affairs", "prosthetic", "orthotic", "visn"]
  },
  {
    lane: "DME, Medicare, and reimbursement infrastructure",
    terms: ["durable medical equipment", "dmepos", "medicare", "medicaid", "cms", "reimbursement"]
  },
  {
    lane: "Medical and rehabilitation supply procurement",
    terms: ["medical supplies", "rehabilitation supplies", "physical therapy", "clinical supplies"]
  },
  {
    lane: "Medical retail, distributor, and channel targets",
    terms: [
      "distribution",
      "distributor",
      "supplier",
      "supply",
      "vendor",
      "laboratories",
      "medical retail",
      "medical supply"
    ]
  },
  {
    lane: "Workers' compensation and occupational health",
    terms: ["workers compensation", "occupational health", "workplace injury", "return to work"]
  },
  {
    lane: "Aging, disability, and community care",
    terms: ["aging", "disability", "mobility", "home health", "community care"]
  },
  {
    lane: "Public safety and first responder health",
    terms: ["public safety", "first responder", "police", "fire", "ems"]
  },
  {
    lane: "School, college, and athletics injury recovery",
    terms: ["athletic", "sports medicine", "student athlete", "college athletics"]
  }
];

export function collectSearchTerms(profile: CompanyProfile, limit = 12): string[] {
  const terms = new Set<string>();
  const rejectedLanes = new Set((profile.rejected_opportunity_lanes ?? []).map((lane) => lane.toLowerCase()));
  const excludeTerms = [...(profile.exclude_terms ?? []), ...(profile.negative_keywords ?? [])].map((term) =>
    term.toLowerCase().trim()
  );

  for (const term of profile.include_terms ?? []) {
    terms.add(term);
  }

  for (const lane of profile.confirmed_opportunity_lanes ?? []) {
    if (!rejectedLanes.has(lane.toLowerCase())) {
      for (const term of profile.lane_search_terms?.[lane] ?? []) {
        terms.add(term);
      }
    }
  }

  for (const lane of profile.opportunity_lanes ?? []) {
    if (rejectedLanes.has(lane.toLowerCase())) continue;
    for (const term of profile.lane_search_terms?.[lane] ?? []) {
      terms.add(term);
    }
  }

  for (const term of profile.public_sector_search_terms ?? []) {
    terms.add(term);
  }

  for (const term of profile.keywords ?? []) {
    terms.add(term);
  }

  return Array.from(terms)
    .filter((term) => term.length >= 4)
    .filter((term) => !excludeTerms.some((excluded) => excluded && term.toLowerCase().includes(excluded)))
    .slice(0, limit);
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evidenceText(...parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function hasStrongEvidence(text: string): boolean {
  return strongEvidenceTerms.some((term) => text.includes(term));
}

export function hasNegativeEvidence(text: string): boolean {
  return negativeEvidenceTerms.some((term) => text.includes(term));
}

export function hasProfileNegativeEvidence(profile: CompanyProfile, text: string): boolean {
  return [...(profile.negative_keywords ?? []), ...(profile.exclude_terms ?? [])]
    .map((term) => term.toLowerCase().trim())
    .filter((term) => term.length >= 3)
    .some((term) => text.includes(term));
}

export function isInfrastructureSignal(text: string): boolean {
  return infrastructureTerms.some((term) => text.includes(term));
}

export function evidenceScore(text: string, query: string): number {
  let score = 42;
  const normalizedQuery = query.toLowerCase();

  if (text.includes(normalizedQuery)) {
    score += 18;
  }

  for (const term of strongEvidenceTerms) {
    if (text.includes(term)) {
      score += 4;
    }
  }

  if (hasNegativeEvidence(text)) {
    score -= 35;
  }

  if (isInfrastructureSignal(text)) {
    score -= 22;
  }

  return clampScore(score);
}

export function inferSignalLane(text: string, fallback = "General public-sector signal"): string {
  for (const matcher of laneMatchers) {
    if (matcher.terms.some((term) => text.includes(term))) {
      return matcher.lane;
    }
  }

  return fallback;
}

export function buildFallbackSignal(
  sourceName: string,
  query: string,
  sourceUrl: string,
  reason: string
): OpportunitySignal {
  return {
    opportunity_title: `${sourceName} search did not return strong matches for "${query}"`,
    source_type: "policy_signal",
    source_name: sourceName,
    source_url: sourceUrl,
    agency_or_funder: "",
    deadline: "",
    geography: "",
    external_evidence_summary: reason,
    why_it_matters:
      "A no-result or weak-result query is still useful because it helps narrow which public-source language works.",
    who_benefits: "",
    likely_buyer_or_partner: "",
    revenue_pathway: "monitor_policy",
    relevance_score: 10,
    novelty_score: 10,
    confidence_score: 30,
    reasoning: ["Connector completed but found no strong match for this query."],
    recommended_action: "Try broader adjacent terms or use a human analyst review for this lane.",
    actionability: "unlikely",
    actionability_reason: "No strong source match was found for this query.",
    best_next_step: "Do not surface as a lead; broaden query terms or add active-source connectors.",
    human_review_required: true,
    query_used: query,
    raw_json: {}
  };
}
