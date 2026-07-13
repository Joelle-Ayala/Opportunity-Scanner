import type { CompanyProfile, ScanInput, SelectedPlaybook } from "./types";

export type OpportunityPlaybook = {
  playbook_id: string;
  name: string;
  description: string;
  implementation_status: "implemented" | "planned";
  trigger_industries: string[];
  trigger_keywords: string[];
  relevant_customer_types: string[];
  opportunity_lanes: string[];
  lane_search_terms: Record<string, string[]>;
  source_categories_to_activate: string[];
  planned_source_categories: string[];
  public_sector_search_terms: string[];
  likely_revenue_motions: string[];
  suggested_contact_roles: string[];
  report_guidance: string;
};

export const opportunityPlaybooks: OpportunityPlaybook[] = [
  {
    playbook_id: "healthcare_rehab_dme",
    name: "Healthcare / Rehab / DME / Medical Supply",
    description:
      "Find public-sector demand around rehab supplies, DME, orthotics, VA purchasing, clinical supply channels, funded buyers, and distributor pathways.",
    implementation_status: "implemented",
    trigger_industries: ["healthcare", "medical", "rehab", "rehabilitation", "durable medical equipment", "dme"],
    trigger_keywords: [
      "medical",
      "rehab",
      "rehabilitation",
      "orthotic",
      "orthotics",
      "prosthetic",
      "dme",
      "durable medical equipment",
      "physical therapy",
      "compression",
      "brace",
      "bracing",
      "clinical supplies",
      "medical supplies",
      "veteran",
      "va"
    ],
    relevant_customer_types: ["Healthcare", "Government", "B2B"],
    opportunity_lanes: [
      "VA, prosthetics, and orthotics purchasing",
      "Medical and rehabilitation supply procurement",
      "Medical retail, distributor, and channel targets",
      "Workers' compensation and occupational health",
      "Aging, disability, and community care"
    ],
    lane_search_terms: {
      "VA, prosthetics, and orthotics purchasing": [
        "VA prosthetics orthotics",
        "orthotic supplies",
        "prosthetic supplies",
        "veteran rehabilitation"
      ],
      "Medical and rehabilitation supply procurement": [
        "rehabilitation supplies",
        "physical therapy supplies",
        "clinical supplies",
        "durable medical equipment"
      ],
      "Medical retail, distributor, and channel targets": [
        "medical supply distributor",
        "rehabilitation supply distributor",
        "durable medical equipment supplier",
        "orthotic supply vendor"
      ],
      "Workers' compensation and occupational health": [
        "workers compensation medical supplies",
        "occupational health",
        "return to work"
      ],
      "Aging, disability, and community care": [
        "disability support services",
        "mobility support",
        "Medicaid waiver supports"
      ]
    },
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: ["sam.gov", "grants.gov", "va procurement", "state medicaid", "state procurement"],
    public_sector_search_terms: [
      "rehabilitation supplies",
      "orthotic supplies",
      "prosthetic supplies",
      "physical therapy supplies",
      "durable medical equipment",
      "medical supply distributor",
      "workers compensation medical supplies",
      "veteran rehabilitation",
      "VA prosthetics orthotics"
    ],
    likely_revenue_motions: [
      "sell_to_agency",
      "sell_to_funded_buyer",
      "partner_with_recipient",
      "bid_on_procurement",
      "channel_or_program_partner",
      "monitor_policy"
    ],
    suggested_contact_roles: [
      "Procurement Specialist",
      "VA Prosthetics Representative",
      "Rehab Services Director",
      "Clinical Supply Manager",
      "DME Category Manager",
      "Workers' Compensation Program Manager",
      "Distributor Sales Lead"
    ],
    report_guidance:
      "Translate the company into public-sector demand around rehab, DME, orthotic/prosthetic supplies, VA purchasing, clinical supply channels, distributor paths, and funded healthcare buyers."
  },
  {
    playbook_id: "music_arts_creative_economy",
    name: "Music / Arts / Creative Economy / Live Performance",
    description:
      "Find public-sector demand around live performance, cultural programming, artist booking, creative workforce, arts education, tourism, placemaking, and public event procurement.",
    implementation_status: "implemented",
    trigger_industries: ["music", "arts", "creative economy", "live entertainment", "event production"],
    trigger_keywords: [
      "music",
      "musician",
      "artist",
      "live performance",
      "entertainment",
      "booking",
      "event production",
      "concert",
      "cultural programming",
      "arts education",
      "creative economy",
      "festival",
      "talent marketplace",
      "performing arts",
      "live event",
      "venue"
    ],
    relevant_customer_types: ["B2B", "Government", "Education", "Nonprofit"],
    opportunity_lanes: [
      "City and county live performance budgets",
      "Parks and recreation concerts/events",
      "Arts and culture grants",
      "School and district arts programming",
      "Creative workforce development",
      "Tourism and placemaking",
      "Downtown revitalization / BID programming",
      "Public event production procurement",
      "Library and community programming",
      "State arts council funding"
    ],
    lane_search_terms: {
      "City and county live performance budgets": [
        "live music performance",
        "music performance",
        "live music services",
        "musical performance services",
        "musical performance",
        "musician services",
        "concert programming",
        "public performance",
        "public concerts",
        "community events"
      ],
      "Parks and recreation concerts/events": [
        "parks recreation concert",
        "summer concert series",
        "event entertainment",
        "performer services"
      ],
      "Arts and culture grants": ["arts grants", "cultural programming", "performing arts services"],
      "School and district arts programming": ["arts education", "teaching artists", "music enrichment"],
      "Creative workforce development": ["creative workforce", "arts workforce", "creative economy workforce"],
      "Tourism and placemaking": ["tourism events", "placemaking arts", "downtown activation"],
      "Downtown revitalization / BID programming": [
        "downtown activation",
        "business improvement district events",
        "public plaza programming",
        "public space activation",
        "downtown partnership events",
        "district event programming",
        "open streets programming",
        "night market entertainment",
        "neighborhood festival programming",
        "public event production"
      ],
      "Public event production procurement": [
        "event production services",
        "event entertainment services",
        "performing artist services",
        "artist booking",
        "festival programming"
      ],
      "Library and community programming": ["library concerts", "community arts programming", "music enrichment"],
      "State arts council funding": ["state arts council funding", "performing arts grants", "creative economy"]
    },
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: [
      "sam.gov",
      "grants.gov",
      "national_endowment_for_the_arts",
      "state_arts_councils",
      "city_county_procurement",
      "parks_and_recreation_departments",
      "tourism_boards",
      "state_education_departments",
      "department_of_education",
      "department_of_labor",
      "workforce_boards",
      "local_arts_commissions"
    ],
    public_sector_search_terms: [
      "live music performance",
      "music performance",
      "live music services",
      "musical performance services",
      "musician services",
      "concert programming",
      "entertainment services",
      "cultural programming",
      "performing arts services",
      "artist booking",
      "performing artist services",
      "event entertainment",
      "public concerts",
      "community events",
      "arts education",
      "teaching artists",
      "creative workforce",
      "music enrichment",
      "festival programming",
      "tourism events",
      "placemaking arts",
      "downtown activation"
    ],
    likely_revenue_motions: [
      "sell_to_agency",
      "sell_to_funded_buyer",
      "partner_with_grantee",
      "bid_on_procurement",
      "channel_or_program_partner",
      "monitor_policy"
    ],
    suggested_contact_roles: [
      "Cultural Affairs Manager",
      "Arts Program Director",
      "Parks and Recreation Director",
      "Events Coordinator",
      "Tourism Director",
      "Downtown Partnership Director",
      "School Arts Coordinator",
      "CTE / Enrichment Program Director",
      "Procurement Specialist",
      "Grants Manager",
      "Workforce Program Manager"
    ],
    report_guidance:
      "Translate the company into public-sector demand around cultural programming, artist booking, public events, creative workforce, arts education, tourism, placemaking, and live-performance procurement."
  },
  {
    playbook_id: "education_workforce_training",
    name: "Education / Workforce / Training",
    description:
      "Find public-sector demand around teacher recruitment, educator workforce, school staffing, training, enrichment, HR/recruiting technology, and workforce programs.",
    implementation_status: "implemented",
    trigger_industries: ["education workforce", "teacher staffing", "school hiring"],
    trigger_keywords: [
      "teacher",
      "teachers",
      "educator",
      "educators",
      "arts education",
      "music education",
      "teaching artist",
      "teaching artists",
      "school arts",
      "arts enrichment",
      "prop 28",
      "proposition 28",
      "calarts",
      "school staffing",
      "teacher recruitment",
      "teacher shortage",
      "teacher residency",
      "substitute teacher",
      "education workforce",
      "school district hiring",
      "hiring platform",
      "recruiting",
      "applicant tracking",
      "job board",
      "teacher hiring platform",
      "educator pipeline"
    ],
    relevant_customer_types: ["Education", "Government", "B2B"],
    opportunity_lanes: [
      "K-12 hiring, teacher staffing, and educator workforce",
      "Arts education and teaching artist staffing",
      "Education workforce grants and technical assistance",
      "Government HR, job board, and recruiting technology procurement",
      "School district procurement and vendor registration",
      "Workforce boards and educator pipeline programs"
    ],
    lane_search_terms: {
      "K-12 hiring, teacher staffing, and educator workforce": [
        "teacher recruitment",
        "educator workforce",
        "school staffing",
        "substitute teacher staffing",
        "teacher shortage",
        "school district hiring"
      ],
      "Arts education and teaching artist staffing": [
        "Prop 28 arts education",
        "Proposition 28 arts education",
        "arts education",
        "music education",
        "teaching artists",
        "school arts staffing",
        "arts enrichment",
        "artist educators",
        "California arts education"
      ],
      "Education workforce grants and technical assistance": [
        "education workforce development",
        "teacher residency",
        "educator preparation",
        "school improvement staffing",
        "state education agency grants"
      ],
      "Government HR, job board, and recruiting technology procurement": [
        "education recruitment platform",
        "applicant tracking system",
        "human resources software",
        "job board services",
        "talent acquisition"
      ],
      "School district procurement and vendor registration": [
        "school district procurement",
        "education technology procurement",
        "district vendor registration",
        "teacher hiring platform"
      ],
      "Workforce boards and educator pipeline programs": [
        "educator pipeline",
        "workforce development education",
        "teacher preparation program",
        "career pathways education"
      ]
    },
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: [
      "sam.gov",
      "grants.gov",
      "department_of_education",
      "department_of_labor",
      "state_education_departments",
      "school_district_procurement",
      "workforce_boards"
    ],
    public_sector_search_terms: [
      "teacher recruitment",
      "educator workforce",
      "school staffing",
      "Prop 28 arts education",
      "Proposition 28 arts education",
      "arts education",
      "music education",
      "teaching artists",
      "school arts staffing",
      "arts enrichment",
      "artist educators",
      "California arts education",
      "substitute teacher staffing",
      "teacher shortage",
      "teacher residency",
      "education recruitment platform",
      "school district hiring",
      "applicant tracking system",
      "education workforce development",
      "teacher preparation program",
      "educator pipeline"
    ],
    likely_revenue_motions: [
      "sell_to_agency",
      "sell_to_funded_buyer",
      "partner_with_grantee",
      "bid_on_procurement",
      "channel_or_program_partner"
    ],
    suggested_contact_roles: [
      "School District HR Director",
      "Chief Talent Officer",
      "Recruitment Director",
      "Arts Education Program Director",
      "VAPA Coordinator",
      "Expanded Learning Director",
      "Arts Funding Program Lead",
      "Superintendent",
      "State Education Agency Program Manager",
      "Workforce Program Manager",
      "Procurement Specialist",
      "Grants Manager"
    ],
    report_guidance:
      "Translate the company into public-sector demand around teacher recruitment, educator workforce, arts education staffing, school enrichment, HR/recruiting technology, workforce boards, school district procurement, and California Prop 28 only when the source is specifically California/Prop 28-related."
  },
  {
    playbook_id: "marketing_advertising_content_web_services",
    name: "Marketing / Advertising / Content / Web Services",
    description:
      "Find public-sector demand for marketing, advertising, public outreach, media buying, content, website, accessibility, and funded-program communications services.",
    implementation_status: "implemented",
    trigger_industries: [
      "marketing-advertising-content-web-services",
      "marketing and advertising services",
      "marketing agency",
      "advertising agency",
      "digital marketing agency",
      "marketing communications agency",
      "public relations agency",
      "content marketing agency",
      "web design agency"
    ],
    trigger_keywords: [
      "government communications",
      "public sector marketing",
      "public outreach campaign",
      "public information campaign",
      "behavior change campaign",
      "multilingual outreach services",
      "media buying services",
      "media planning and buying",
      "digital advertising services",
      "paid media management",
      "advertising campaign management",
      "search engine marketing services",
      "social media management services",
      "content marketing services",
      "copywriting services",
      "public relations services",
      "brand strategy services",
      "website redesign",
      "web design services",
      "website development services",
      "website accessibility services",
      "section 508 remediation",
      "full-service advertising agency",
      "integrated marketing agency",
      "creative marketing agency"
    ],
    relevant_customer_types: ["B2B", "Government", "Nonprofit"],
    opportunity_lanes: [
      "Government marketing, communications, and public outreach procurement",
      "Public information and behavior-change campaigns",
      "Digital advertising, media planning, and media buying",
      "Government website redesign, accessibility, and content services",
      "Funded-program outreach, enrollment, and stakeholder communications",
      "Tourism and economic-development destination marketing"
    ],
    lane_search_terms: {
      "Government marketing, communications, and public outreach procurement": [
        "government marketing services",
        "communications strategy services",
        "public relations services",
        "public outreach campaign",
        "community engagement communications",
        "multilingual outreach services"
      ],
      "Public information and behavior-change campaigns": [
        "public information campaign",
        "behavior change communications",
        "public awareness campaign",
        "health communications campaign",
        "emergency communications campaign"
      ],
      "Digital advertising, media planning, and media buying": [
        "digital advertising services",
        "media planning services",
        "media buying services",
        "paid media campaign",
        "social media management services",
        "search engine marketing services"
      ],
      "Government website redesign, accessibility, and content services": [
        "government website redesign",
        "website development services",
        "web content strategy",
        "website accessibility remediation",
        "Section 508 website compliance",
        "government web content services"
      ],
      "Funded-program outreach, enrollment, and stakeholder communications": [
        "program outreach services",
        "enrollment campaign services",
        "grant-funded communications",
        "stakeholder engagement campaign",
        "benefits outreach campaign",
        "multilingual program communications"
      ],
      "Tourism and economic-development destination marketing": [
        "destination marketing services",
        "tourism marketing campaign",
        "economic development marketing",
        "place branding services",
        "visitor marketing services"
      ]
    },
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: [
      "sam.gov",
      "grants.gov",
      "gsa",
      "state_procurement",
      "city_county_procurement",
      "tourism_boards"
    ],
    public_sector_search_terms: [
      "government marketing services",
      "communications strategy services",
      "public relations services",
      "public outreach campaign",
      "public information campaign",
      "behavior change communications",
      "public awareness campaign",
      "multilingual outreach services",
      "digital advertising services",
      "media planning services",
      "media buying services",
      "social media management services",
      "search engine marketing services",
      "government website redesign",
      "website development services",
      "website accessibility remediation",
      "Section 508 website compliance",
      "government web content services",
      "program outreach services",
      "enrollment campaign services",
      "grant-funded communications",
      "stakeholder engagement campaign",
      "destination marketing services",
      "tourism marketing campaign",
      "economic development marketing"
    ],
    likely_revenue_motions: [
      "sell_to_agency",
      "sell_to_funded_buyer",
      "partner_with_recipient",
      "bid_on_procurement",
      "channel_or_program_partner",
      "monitor_policy"
    ],
    suggested_contact_roles: [
      "Communications Director",
      "Public Information Officer",
      "Marketing and Communications Director",
      "Public Outreach Program Manager",
      "Digital Services Manager",
      "Web Content Manager",
      "ADA / Section 508 Coordinator",
      "Tourism Marketing Director",
      "Procurement Specialist",
      "Contracting Officer",
      "Prime Contractor Partner Manager"
    ],
    report_guidance:
      "Translate the company into specific public-sector service demand for campaigns, outreach, media buying, content, and accessible websites; distinguish active solicitations from historical awards or policy signals, and identify the buying department, required deliverables, vendor-registration path, incumbent or prime-partner route, and next action."
  },
  {
    playbook_id: "manufacturing_economic_development_export",
    name: "Manufacturing / Economic Development / Export",
    description: "Planned vertical for manufacturing, economic development, export, supply chain, and industrial programs.",
    implementation_status: "planned",
    trigger_industries: ["manufacturing", "export", "supply chain", "economic development"],
    trigger_keywords: ["manufacturing", "factory", "export", "supply chain", "industrial"],
    relevant_customer_types: ["B2B", "Government"],
    opportunity_lanes: ["Economic development incentives", "Manufacturing grants", "Export promotion"],
    lane_search_terms: {},
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: ["sam.gov", "grants.gov", "state_economic_development", "export_import_bank"],
    public_sector_search_terms: ["advanced manufacturing", "supply chain resilience", "export promotion"],
    likely_revenue_motions: ["direct_apply", "partner_with_grantee", "bid_on_procurement"],
    suggested_contact_roles: ["Economic Development Director", "Manufacturing Program Manager", "Export Advisor"],
    report_guidance: "Use for production, supply-chain, export, and economic-development scans."
  },
  {
    playbook_id: "government_b2b_services",
    name: "Government Services / B2B Services",
    description: "Planned vertical for consultancies, IT services, data, operations, and professional services.",
    implementation_status: "planned",
    trigger_industries: ["consulting", "software", "data", "professional services", "government services"],
    trigger_keywords: ["consulting", "software", "data", "analytics", "platform", "professional services"],
    relevant_customer_types: ["B2B", "Government"],
    opportunity_lanes: ["Professional services procurement", "Government IT modernization", "Technical assistance"],
    lane_search_terms: {},
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: ["sam.gov", "gsa", "state_procurement"],
    public_sector_search_terms: ["professional services", "technical assistance", "IT modernization"],
    likely_revenue_motions: ["sell_to_agency", "bid_on_procurement", "channel_or_program_partner"],
    suggested_contact_roles: ["Contracting Officer", "Program Manager", "IT Modernization Lead"],
    report_guidance: "Use for B2B services, consulting, software, data, and government service vendors."
  }
];

function normalizedText(profile: CompanyProfile, input?: ScanInput): string {
  return [
    profile.company_name,
    profile.summary,
    ...(profile.products_services ?? []),
    ...(profile.target_customers ?? []),
    ...(profile.industries ?? []),
    ...(profile.keywords ?? []),
    input?.opportunityFocus,
    input?.includeTerms,
    input?.excludeTerms,
    ...(input?.prioritySignals ?? []),
    input?.companyName,
    input?.industry,
    input?.customerType
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTerm(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`).test(text);
}

function isOffVerticalLane(lane: string, selectedIds: Set<string>): boolean {
  const normalized = lane.toLowerCase();
  if (!selectedIds.has("music_arts_creative_economy")) {
    if (/music|artist|arts|creative|cultural|entertainment|concert|festival|venue|live event|public event/.test(normalized)) {
      return true;
    }
  }
  if (!selectedIds.has("education_workforce_training")) {
    if (/teacher|educator|school staffing|recruiting technology|job board|talent acquisition/.test(normalized)) {
      return true;
    }
  }
  if (!selectedIds.has("healthcare_rehab_dme")) {
    if (/medical|healthcare|clinical|rehab|dme|prosthetic|orthotic|medicare|medicaid|veteran/.test(normalized)) {
      return true;
    }
  }
  if (!selectedIds.has("marketing_advertising_content_web_services")) {
    if (
      /advertising|marketing communications|media buying|website redesign|website accessibility|public outreach|public information campaign|behavior-change campaign|destination marketing/.test(
        normalized
      )
    ) {
      return true;
    }
  }
  return false;
}

export function matchPlaybooks(profile: CompanyProfile, input?: ScanInput): SelectedPlaybook[] {
  const text = normalizedText(profile, input);
  const customerType = input?.customerType ?? profile.target_customers?.[0] ?? "";

  const scoredPlaybooks = opportunityPlaybooks
    .map((playbook) => {
      const matchedTerms = unique(
        [...playbook.trigger_industries, ...playbook.trigger_keywords].filter((term) =>
          includesTerm(text, term)
        )
      );
      const customerMatch = customerType
        ? playbook.relevant_customer_types.some(
            (type) => type.toLowerCase() === customerType.toLowerCase()
          )
        : false;
      const implementedBoost = playbook.implementation_status === "implemented" ? 10 : 0;
      const matchScore = matchedTerms.length * 12 + (customerMatch ? 8 : 0) + implementedBoost;

      return {
        playbook,
        matchedTerms,
        matchScore
      };
    })
    .filter(({ matchedTerms, matchScore }) => matchedTerms.length > 0 && matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore);
  const educationMatched = scoredPlaybooks.some(
    ({ playbook }) => playbook.playbook_id === "education_workforce_training"
  );
  const strongLivePerformanceContext =
    /jammcard|live performance|artist booking|event production|concert|festival|talent marketplace|performing artist|live entertainment|public event|venue/.test(
      text
    );

  return scoredPlaybooks
    .filter(({ playbook }) => {
      if (
        playbook.playbook_id === "music_arts_creative_economy" &&
        educationMatched &&
        !strongLivePerformanceContext
      ) {
        return false;
      }
      return true;
    })
    .slice(0, 2)
    .map(({ playbook, matchedTerms, matchScore }) => ({
      playbook_id: playbook.playbook_id,
      name: playbook.name,
      match_score: Math.min(100, matchScore),
      matched_terms: matchedTerms.slice(0, 12),
      source_categories_to_activate: playbook.source_categories_to_activate,
      planned_source_categories: playbook.planned_source_categories,
      likely_revenue_motions: playbook.likely_revenue_motions,
      suggested_contact_roles: playbook.suggested_contact_roles,
      report_guidance: playbook.report_guidance
    }));
}

export function applyPlaybooksToProfile(profile: CompanyProfile, input?: ScanInput): CompanyProfile {
  const selectedPlaybooks = matchPlaybooks(profile, input);
  const selectedDefinitions = selectedPlaybooks
    .map((match) => opportunityPlaybooks.find((playbook) => playbook.playbook_id === match.playbook_id))
    .filter((playbook): playbook is OpportunityPlaybook => Boolean(playbook));
  const selectedIds = new Set(selectedDefinitions.map((playbook) => playbook.playbook_id));
  const unselectedImplementedPlaybooks = opportunityPlaybooks.filter(
    (playbook) => playbook.implementation_status === "implemented" && !selectedIds.has(playbook.playbook_id)
  );
  const excludedLanes = new Set(
    selectedDefinitions.length > 0
      ? unselectedImplementedPlaybooks.flatMap((playbook) => playbook.opportunity_lanes)
      : []
  );
  const excludedSearchTerms = new Set(
    selectedDefinitions.length > 0
      ? unselectedImplementedPlaybooks.flatMap((playbook) => playbook.public_sector_search_terms)
      : []
  );

  const laneSearchTerms = { ...(profile.lane_search_terms ?? {}) };
  for (const playbook of selectedDefinitions) {
    for (const [lane, terms] of Object.entries(playbook.lane_search_terms)) {
      laneSearchTerms[lane] = unique([...(laneSearchTerms[lane] ?? []), ...terms]);
    }
  }
  for (const lane of Object.keys(laneSearchTerms)) {
    if (excludedLanes.has(lane) || isOffVerticalLane(lane, selectedIds)) {
      delete laneSearchTerms[lane];
    }
  }

  return {
    ...profile,
    selected_playbooks: selectedPlaybooks,
    opportunity_lanes: unique([
      ...(profile.opportunity_lanes ?? []).filter(
        (lane) => !excludedLanes.has(lane) && !isOffVerticalLane(lane, selectedIds)
      ),
      ...selectedDefinitions.flatMap((playbook) => playbook.opportunity_lanes)
    ]),
    lane_search_terms: laneSearchTerms,
    public_sector_search_terms: unique([
      ...selectedDefinitions.flatMap((playbook) => playbook.public_sector_search_terms),
      ...(profile.public_sector_search_terms ?? []).filter((term) => !excludedSearchTerms.has(term))
    ]).slice(0, 40),
    translated_public_sector_terms: unique([
      ...selectedDefinitions.flatMap((playbook) => playbook.public_sector_search_terms),
      ...(profile.translated_public_sector_terms ?? profile.public_sector_search_terms ?? []).filter(
        (term) => !excludedSearchTerms.has(term)
      )
    ]).slice(0, 40),
    activated_source_categories: unique(
      selectedDefinitions.flatMap((playbook) => playbook.source_categories_to_activate)
    ),
    planned_source_categories: unique(
      selectedDefinitions.flatMap((playbook) => playbook.planned_source_categories)
    ),
    likely_revenue_motions: unique(
      selectedDefinitions.flatMap((playbook) => playbook.likely_revenue_motions)
    ),
    suggested_contact_roles: unique(
      selectedDefinitions.flatMap((playbook) => playbook.suggested_contact_roles)
    ),
    report_guidance: selectedDefinitions.map((playbook) => playbook.report_guidance)
  };
}
