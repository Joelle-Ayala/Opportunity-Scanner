import { applyPlaybooksToProfile } from "./playbooks";
import { ensureProfileRefinementFields } from "./profileRefinement";
import type { CompanyProfile, ScanInput } from "./types";

const opportunityCategories = [
  "grants",
  "procurement",
  "reimbursement",
  "tax_incentives",
  "workforce_funding",
  "regulatory_change",
  "state_programs",
  "funded_buyer_targets"
];

const publicSectorTermMap: Record<string, string[]> = {
  healthcare: ["health services", "clinical support", "patient outcomes", "reimbursement"],
  medical: ["durable medical equipment", "medical supplies", "care delivery"],
  education: ["student support services", "education technology", "school improvement"],
  music: ["creative economy", "arts workforce", "cultural programming", "music education"],
  creative: ["creative economy", "artist services", "cultural programming", "creative workforce"],
  entertainment: ["live entertainment", "event production", "cultural venues", "performing arts"],
  "marketing-advertising-content-web-services": [
    "government marketing services",
    "public outreach campaigns",
    "media buying services",
    "government website redesign"
  ],
  "marketing agency": ["government marketing services", "public outreach campaigns", "media buying services"],
  "advertising agency": ["advertising services", "media planning services", "public awareness campaigns"],
  "public relations agency": ["public relations services", "public information campaigns", "stakeholder communications"],
  "web design agency": ["government website redesign", "website accessibility remediation", "web content services"],
  "content marketing agency": ["content strategy services", "public outreach content", "program communications"],
  workforce: ["workforce development", "training services", "labor market programs"],
  software: ["IT services", "software licensing", "data systems", "cloud services"],
  data: ["analytics", "performance measurement", "evidence-building"],
  climate: ["resilience", "clean energy", "environmental services"],
  manufacturing: ["advanced manufacturing", "supply chain resilience"],
  safety: ["public safety", "risk reduction", "emergency preparedness"],
  training: ["technical assistance", "capacity building", "workforce training"]
};

const prioritySignalTerms: Record<string, string[]> = {
  live_performance_events: [
    "live music performance",
    "music performance",
    "musician services",
    "event entertainment",
    "concert programming",
    "public concerts",
    "festival entertainment",
    "public event production"
  ],
  active_contracts: ["contract opportunities", "procurement", "solicitation", "bid opportunity"],
  grants_funding: ["grants", "funding opportunity", "grant program", "direct apply"],
  funded_buyers: ["funded buyer", "award recipient", "grantee", "federal award recipient"],
  partners_channels: ["implementation partner", "channel partner", "prime contractor", "subrecipient"],
  policy_signals: ["policy signal", "federal register", "regulatory demand", "agency priority"],
  state_local: ["state procurement", "city procurement", "county procurement", "local government", "state grants"]
};

const opportunityLaneRules: Array<{
  lane: string;
  triggers: RegExp;
  terms: string[];
}> = [
  {
    lane: "K-12 hiring, teacher staffing, and educator workforce",
    triggers: /school district|teacher|educator|substitute teacher|teacher shortage|teacher recruitment|school staffing|educator workforce/,
    terms: [
      "teacher recruitment",
      "educator workforce",
      "school staffing",
      "substitute teacher staffing",
      "teacher shortage",
      "education recruitment platform",
      "school district hiring"
    ]
  },
  {
    lane: "Education workforce grants and technical assistance",
    triggers: /education workforce|teacher residency|educator preparation|school improvement|state education agency|teacher|educator/,
    terms: [
      "education workforce development",
      "teacher residency",
      "educator preparation",
      "school improvement staffing",
      "workforce development education",
      "state education agency grants"
    ]
  },
  {
    lane: "Government HR, job board, and recruiting technology procurement",
    triggers: /platform|software|jobs|job board|hiring|recruiting|recruitment|talent|staffing|school|district/,
    terms: [
      "recruiting software",
      "applicant tracking system",
      "human resources software",
      "job board services",
      "talent acquisition",
      "education technology procurement"
    ]
  },
  {
    lane: "City, state, and public venue entertainment procurement",
    triggers: /music|musician|artist|artists|entertainment|performing arts|live event|venue|festival|concert|event production/,
    terms: [
      "musical performance services",
      "live music performance",
      "event entertainment services",
      "festival entertainment",
      "concert programming",
      "performer services",
      "public event production",
      "venue entertainment"
    ]
  },
  {
    lane: "Creative workforce and music-industry talent networks",
    triggers: /music|musician|artist|artists|creative|entertainment|performing arts|jammcard|live event|venue|production/,
    terms: [
      "creative economy workforce",
      "arts workforce",
      "music workforce",
      "artist services",
      "creative workforce development",
      "entertainment workforce"
    ]
  },
  {
    lane: "Cultural programming, live events, and public arts buyers",
    triggers: /music|musician|artist|artists|creative economy|cultural|performing arts|festival|concert|venue|live entertainment|event production/,
    terms: [
      "cultural programming",
      "performing arts",
      "music education",
      "public arts program",
      "live entertainment",
      "event production services",
      "arts grants"
    ]
  },
  {
    lane: "Government marketing, communications, and public outreach procurement",
    triggers:
      /marketing agency|advertising agency|marketing communications agency|public relations agency|government communications|public sector marketing|public outreach campaign|multilingual outreach services/,
    terms: [
      "government marketing services",
      "communications strategy services",
      "public relations services",
      "public outreach campaign",
      "community engagement communications",
      "multilingual outreach services"
    ]
  },
  {
    lane: "Public information and behavior-change campaigns",
    triggers: /public information campaign|behavior change campaign|public awareness campaign|health communications campaign/,
    terms: [
      "public information campaign",
      "behavior change communications",
      "public awareness campaign",
      "health communications campaign",
      "emergency communications campaign"
    ]
  },
  {
    lane: "Digital advertising, media planning, and media buying",
    triggers:
      /digital marketing agency|digital advertising services|media buying services|media planning and buying|paid media management|advertising campaign management|search engine marketing services/,
    terms: [
      "digital advertising services",
      "media planning services",
      "media buying services",
      "paid media campaign",
      "social media management services",
      "search engine marketing services"
    ]
  },
  {
    lane: "Government website redesign, accessibility, and content services",
    triggers:
      /web design agency|website redesign|web design services|website development services|website accessibility services|section 508 remediation/,
    terms: [
      "government website redesign",
      "website development services",
      "web content strategy",
      "website accessibility remediation",
      "Section 508 website compliance",
      "government web content services"
    ]
  },
  {
    lane: "Funded-program outreach, enrollment, and stakeholder communications",
    triggers:
      /content marketing agency|content marketing services|program outreach services|enrollment campaign services|grant-funded communications|stakeholder engagement campaign/,
    terms: [
      "program outreach services",
      "enrollment campaign services",
      "grant-funded communications",
      "stakeholder engagement campaign",
      "benefits outreach campaign",
      "multilingual program communications"
    ]
  },
  {
    lane: "Tourism and economic-development destination marketing",
    triggers: /destination marketing services|tourism marketing campaign|economic development marketing|place branding services/,
    terms: [
      "destination marketing services",
      "tourism marketing campaign",
      "economic development marketing",
      "place branding services",
      "visitor marketing services"
    ]
  },
  {
    lane: "Healthcare, rehab, and clinical supply channels",
    triggers: /health|medical|clinical|patient|rehab|therapy|orthotic|brace|compression|recovery|pain|post-?op|dme/,
    terms: [
      "rehabilitation supplies",
      "orthotic supplies",
      "durable medical equipment",
      "physical therapy supplies",
      "post-operative recovery",
      "non-opioid pain support"
    ]
  },
  {
    lane: "Medical retail, distributor, and channel targets",
    triggers: /health|medical|rehab|orthotic|brace|compression|sleeve|recovery|dme|supply|supplies|retail|store|distribution|distributor/,
    terms: [
      "medical supply distributor",
      "rehabilitation supply distributor",
      "durable medical equipment supplier",
      "orthotic supply vendor",
      "prosthetic orthotic supplier",
      "medical retail supply",
      "compression garment supplier",
      "bracing supplies"
    ]
  },
  {
    lane: "Workers' compensation and return-to-work programs",
    triggers: /workers'? compensation|workplace injury|return-to-work|occupational health|occupational injury|employer wellness|ergonomic/,
    terms: [
      "workers compensation medical supplies",
      "occupational health",
      "return to work",
      "workplace injury recovery",
      "employer injury prevention"
    ]
  },
  {
    lane: "VA, military, and veteran rehabilitation",
    triggers: /veteran|military|tactical|rehab|orthotic|brace|compression|pain|recovery|mobility/,
    terms: [
      "veteran rehabilitation",
      "VA prosthetics orthotics",
      "military medical supplies",
      "mobility support",
      "wounded warrior rehabilitation"
    ]
  },
  {
    lane: "Public safety injury prevention and recovery",
    triggers: /safety|police|fire|ems|first responder|injury|recovery|pain|brace|compression|tactical/,
    terms: [
      "first responder injury recovery",
      "public safety wellness",
      "police fire medical supplies",
      "EMS injury prevention",
      "tactical recovery support"
    ]
  },
  {
    lane: "Aging, disability, and community support programs",
    triggers: /aging|senior|disability|mobility|arthritis|medicaid waiver|home health|community care/,
    terms: [
      "aging services",
      "disability support services",
      "Medicaid waiver supports",
      "arthritis support",
      "mobility support"
    ]
  },
  {
    lane: "Institutional healthcare and corrections procurement",
    triggers: /medical supplies|clinical supplies|correctional healthcare|institutional healthcare|facility healthcare/,
    terms: [
      "institutional medical supplies",
      "correctional healthcare",
      "facility healthcare supplies",
      "agency medical procurement"
    ]
  },
  {
    lane: "School, college, and athletics injury recovery",
    triggers: /athletic|sports medicine|student athlete|athletic trainer|school injury|college athletics/,
    terms: [
      "athletic training supplies",
      "sports medicine",
      "school athletics injury recovery",
      "college athletic training",
      "student athlete rehabilitation"
    ]
  },
  {
    lane: "Employer wellness and occupational health",
    triggers: /employer|wellness|occupational|workplace|injury|pain|recovery|prevention|ergonomic/,
    terms: [
      "employer wellness",
      "occupational health programs",
      "workplace injury prevention",
      "ergonomic recovery",
      "employee health benefits"
    ]
  }
];

const naicsCandidates: Record<string, string[]> = {
  healthcare: ["621999 - All Other Miscellaneous Ambulatory Health Care Services"],
  medical: ["339113 - Surgical Appliance and Supplies Manufacturing"],
  education: ["611710 - Educational Support Services"],
  workforce: ["611430 - Professional and Management Development Training"],
  software: ["541511 - Custom Computer Programming Services", "541512 - Computer Systems Design Services"],
  data: ["541611 - Administrative Management and General Management Consulting Services"],
  manufacturing: ["541715 - Research and Development in Nanotechnology"],
  training: ["611430 - Professional and Management Development Training"]
};

const socCandidates: Record<string, string[]> = {
  healthcare: ["29-0000 - Healthcare Practitioners and Technical Occupations"],
  education: ["25-0000 - Educational Instruction and Library Occupations"],
  workforce: ["13-1151 - Training and Development Specialists"],
  software: ["15-1252 - Software Developers"],
  data: ["15-2051 - Data Scientists"],
  manufacturing: ["17-2112 - Industrial Engineers"],
  training: ["13-1151 - Training and Development Specialists"]
};

function pickTerms(text: string, max = 18): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "your",
    "our",
    "are",
    "you",
    "not",
    "all",
    "can",
    "has",
    "have",
    "will",
    "more",
    "about",
    "into",
    "their"
  ]);
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z-]{3,}/g)) {
    const word = match[0].replace(/-$/, "");
    if (!stop.has(word)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function phraseTerms(value?: string): string[] {
  return unique(
    (value ?? "")
      .split(/[\n,;]+/)
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 3)
  ).slice(0, 24);
}

function intentText(input: ScanInput): string {
  return [
    input.opportunityFocus,
    input.includeTerms,
    input.excludeTerms,
    ...(input.prioritySignals ?? [])
  ]
    .filter(Boolean)
    .join(" ");
}

function intentTerms(input: ScanInput): string[] {
  return unique([
    ...phraseTerms(input.includeTerms),
    ...(input.prioritySignals ?? []).flatMap((signal) => prioritySignalTerms[signal] ?? []),
    ...pickTerms(input.opportunityFocus ?? "", 10)
  ]).slice(0, 24);
}

function excludeTerms(input: ScanInput): string[] {
  return unique(phraseTerms(input.excludeTerms));
}

function inferPublicSectorTerms(keywords: string[], industry?: string, input?: ScanInput): string[] {
  const haystack = `${keywords.join(" ")} ${industry ?? ""} ${input ? intentText(input) : ""}`.toLowerCase();
  const terms = new Set<string>();

  if (input) {
    intentTerms(input).forEach((term) => terms.add(term));
  }

  for (const [needle, mapped] of Object.entries(publicSectorTermMap)) {
    if (haystack.includes(needle)) {
      mapped.forEach((term) => terms.add(term));
    }
  }

  keywords.slice(0, 8).forEach((keyword) => terms.add(keyword));
  terms.add("procurement");
  terms.add("federal funding");
  terms.add("state programs");

  return Array.from(terms).slice(0, 16);
}

function inferOpportunityLanes(keywords: string[], rawText: string, industry?: string, input?: ScanInput) {
  const haystack = `${keywords.join(" ")} ${industry ?? ""} ${input ? intentText(input) : ""} ${rawText.slice(0, 6000)}`.toLowerCase();
  const laneSearchTerms: Record<string, string[]> = {};

  for (const rule of opportunityLaneRules) {
    if (rule.triggers.test(haystack)) {
      laneSearchTerms[rule.lane] = rule.terms;
    }
  }

  if (Object.keys(laneSearchTerms).length === 0) {
    laneSearchTerms["General public procurement and funded-buyer discovery"] = [
      "public procurement",
      "federal awards",
      "state programs",
      "funded recipients"
    ];
  }

  return {
    opportunityLanes: Object.keys(laneSearchTerms).slice(0, 8),
    laneSearchTerms
  };
}

function inferPolicyCategories(terms: string[]): string[] {
  const joined = terms.join(" ").toLowerCase();
  const categories = new Set<string>();
  if (/health|medical|clinical|patient|reimbursement/.test(joined)) {
    categories.add("healthcare_reimbursement");
  }
  if (/education|student|school/.test(joined)) {
    categories.add("education_funding");
  }
  if (/workforce|training|labor/.test(joined)) {
    categories.add("workforce_development");
  }
  if (/software|data|cloud|analytics|it/.test(joined)) {
    categories.add("government_it_modernization");
  }
  if (/climate|energy|environment|resilience/.test(joined)) {
    categories.add("climate_and_resilience");
  }
  if (categories.size === 0) {
    categories.add("public_procurement");
  }
  return Array.from(categories);
}

function inferCandidateCodes(
  keywords: string[],
  industry: string | undefined,
  dictionary: Record<string, string[]>
): string[] {
  const haystack = `${keywords.join(" ")} ${industry ?? ""}`.toLowerCase();
  const candidates = new Set<string>();

  for (const [needle, values] of Object.entries(dictionary)) {
    if (haystack.includes(needle)) {
      values.forEach((value) => candidates.add(value));
    }
  }

  return Array.from(candidates).slice(0, 6);
}

function normalizeProfile(profile: CompanyProfile, input: ScanInput): CompanyProfile {
  const focusKeywords = pickTerms(input.opportunityFocus ?? "", 10);
  const includeKeywords = phraseTerms(input.includeTerms);
  const excluded = excludeTerms(input);
  const inferredLanes = inferOpportunityLanes(
    [...(profile.keywords ?? []), ...focusKeywords, ...includeKeywords],
    `${input.opportunityFocus ?? ""}\n${input.includeTerms ?? ""}`,
    input.industry,
    input
  );
  const publicSectorTerms =
    profile.public_sector_search_terms?.length > 0
      ? profile.public_sector_search_terms
      : profile.translated_public_sector_terms ?? [];
  const enrichedTerms = unique([...intentTerms(input), ...publicSectorTerms]);

  return ensureProfileRefinementFields(applyPlaybooksToProfile({
    ...profile,
    website: input.companyUrl,
    keywords: unique([...(profile.keywords ?? []), ...focusKeywords, ...includeKeywords]),
    public_sector_search_terms: enrichedTerms,
    translated_public_sector_terms: enrichedTerms,
    negative_keywords: unique([...(profile.negative_keywords ?? []), ...excluded]),
    possible_naics: profile.possible_naics ?? [],
    possible_psc: profile.possible_psc ?? [],
    possible_soc: profile.possible_soc ?? [],
    opportunity_lanes: unique([...(inferredLanes.opportunityLanes ?? []), ...(profile.opportunity_lanes ?? [])]),
    lane_search_terms: { ...inferredLanes.laneSearchTerms, ...(profile.lane_search_terms ?? {}) },
    opportunity_categories: opportunityCategories,
    selected_playbooks: profile.selected_playbooks ?? [],
    activated_source_categories: profile.activated_source_categories ?? [],
    planned_source_categories: profile.planned_source_categories ?? [],
    likely_revenue_motions: profile.likely_revenue_motions ?? [],
    suggested_contact_roles: profile.suggested_contact_roles ?? [],
    report_guidance: profile.report_guidance ?? []
  }, input), input);
}

export type ProfileGenerationOptions = {
  signal?: AbortSignal;
  deadlineAtMs?: number;
  timeoutMs?: number;
};

const DEFAULT_PROFILE_REQUEST_TIMEOUT_MS = 15_000;

async function generateWithOpenAi(
  input: ScanInput,
  rawText: string,
  options: ProfileGenerationOptions
): Promise<CompanyProfile | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const deadlineRemaining =
    options.deadlineAtMs === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, options.deadlineAtMs - Date.now());
  if (deadlineRemaining <= 0 || options.signal?.aborted) {
    throw new Error("Company profile generation deadline expired before the OpenAI request started.");
  }

  const timeoutMs = Math.max(
    1,
    Math.min(
      DEFAULT_PROFILE_REQUEST_TIMEOUT_MS,
      options.timeoutMs ?? DEFAULT_PROFILE_REQUEST_TIMEOUT_MS,
      deadlineRemaining
    )
  );
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Create a source-grounded company profile for a public-sector opportunity scanner. " +
              "Use only the submitted scan intent and website text. Identify what the company actually sells, who can buy it, and the specific public-sector revenue motions that fit. " +
              "Keep products and buyer types as precise multi-word phrases; do not promote adjacent website topics into offerings. " +
              "Good-fit examples must describe records with a credible path to revenue, while bad-fit examples must name tempting but irrelevant matches. " +
              "Search terms should be language an agency, grant program, prime, or funded recipient would use in an official record. " +
              "Use a profile confidence score below 55 when the offering, buyer, or requested scan focus is ambiguous. " +
              "Do not invent external opportunities, contracts, grants, buyers, eligibility, or company capabilities. Return only the requested JSON object."
          },
          {
            role: "user",
            content: JSON.stringify({
              scan_input: input,
              required_schema: {
                company_name: "",
                website: "",
                summary: "",
                products_services: [],
                inferred_products_services: [],
                target_customers: [],
                inferred_target_customers: [],
                industries: [],
                geographies: [],
                keywords: [],
                inferred_public_sector_lanes: [],
                inferred_buyer_partner_types: [],
                inferred_revenue_motions: [],
                public_sector_search_terms: [],
                translated_public_sector_terms: [],
                include_terms: [],
                exclude_terms: [],
                target_geographies: [],
                priority_signals: [],
                good_fit_examples: [],
                bad_fit_examples: [],
                confirmed_opportunity_lanes: [],
                rejected_opportunity_lanes: [],
                profile_confidence_score: 0,
                profile_assumptions_summary: "",
                negative_keywords: [],
                possible_naics: [],
                possible_psc: [],
                possible_soc: [],
                policy_sensitive_categories: [],
                opportunity_lanes: [],
                lane_search_terms: {},
                opportunity_categories: opportunityCategories,
                selected_playbooks: [],
                activated_source_categories: [],
                planned_source_categories: [],
                likely_revenue_motions: [],
                suggested_contact_roles: [],
                report_guidance: []
              },
              website_text: rawText.slice(0, 30000)
            })
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    return JSON.parse(content) as CompanyProfile;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Company profile generation timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

export async function generateCompanyProfile(
  input: ScanInput,
  rawText: string,
  options: ProfileGenerationOptions = {}
): Promise<CompanyProfile> {
  const aiProfile = await generateWithOpenAi(input, rawText, options);
  if (aiProfile) {
    return normalizeProfile(aiProfile, input);
  }

  const keywords = pickTerms(rawText);
  const focusKeywords = pickTerms(input.opportunityFocus ?? "", 10);
  const includeKeywords = phraseTerms(input.includeTerms);
  const keywordsWithIntent = unique([...includeKeywords, ...focusKeywords, ...keywords]);
  const translatedTerms = inferPublicSectorTerms(keywordsWithIntent, input.industry, input);
  const lanes = inferOpportunityLanes(
    keywordsWithIntent,
    `${input.opportunityFocus ?? ""}\n${input.includeTerms ?? ""}\n${rawText}`,
    input.industry,
    input
  );
  const host = new URL(input.companyUrl).hostname.replace(/^www\./, "");

  const fallbackProfile = ensureProfileRefinementFields(applyPlaybooksToProfile({
    company_name: input.companyName || host.split(".")[0],
    website: input.companyUrl,
    summary:
      rawText.slice(0, 420) ||
      "Initial profile generated from the submitted company website. Add an AI API key for richer extraction.",
    products_services: keywordsWithIntent.slice(0, 8),
    target_customers: input.customerType ? [input.customerType] : [],
    industries: input.industry ? [input.industry] : [],
    geographies: [input.headquartersState, input.targetStates].filter(Boolean) as string[],
    keywords: keywordsWithIntent,
    public_sector_search_terms: translatedTerms,
    translated_public_sector_terms: translatedTerms,
    negative_keywords: unique([
      "jobs",
      "careers",
      "press release",
      "investor relations",
      ...excludeTerms(input)
    ]),
    possible_naics: inferCandidateCodes(keywords, input.industry, naicsCandidates),
    possible_psc: [],
    possible_soc: inferCandidateCodes(keywords, input.industry, socCandidates),
    policy_sensitive_categories: inferPolicyCategories(translatedTerms),
    opportunity_lanes: lanes.opportunityLanes,
    lane_search_terms: lanes.laneSearchTerms,
    opportunity_categories: opportunityCategories,
    selected_playbooks: [],
    activated_source_categories: [],
    planned_source_categories: [],
    likely_revenue_motions: [],
    suggested_contact_roles: [],
    report_guidance: [],
    profile_confidence_score: 35
  }, input), input);

  return {
    ...fallbackProfile,
    profile_confidence_score: 35,
    profile_assumptions_summary: [
      "The AI profile step was unavailable, so these assumptions were generated from submitted text and website keywords only.",
      fallbackProfile.profile_assumptions_summary
    ].filter(Boolean).join(" "),
    report_guidance: unique([
      "Keyword-only fallback profile. Hold results for review until the company's offering and buyer assumptions are verified.",
      ...(fallbackProfile.report_guidance ?? [])
    ])
  };
}
