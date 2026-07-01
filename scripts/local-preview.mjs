import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), filename);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!key || process.env[key]) continue;
      process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

loadLocalEnv();

const port = Number(process.env.PORT || 3000);
const dataPath = path.join(process.cwd(), ".data", "local-db.json");
const maxPages = 8;
const maxChars = 40000;
const likelyPaths = [
  "/",
  "/about",
  "/about-us",
  "/products",
  "/product",
  "/services",
  "/solutions",
  "/industries",
  "/customers"
];

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

const publicSectorTermMap = {
  healthcare: ["health services", "clinical support", "patient outcomes", "reimbursement"],
  medical: ["durable medical equipment", "medical supplies", "care delivery"],
  education: ["student support services", "education technology", "school improvement"],
  music: ["creative economy", "arts workforce", "cultural programming", "music education"],
  creative: ["creative economy", "artist services", "cultural programming", "creative workforce"],
  entertainment: ["live entertainment", "event production", "cultural venues", "performing arts"],
  workforce: ["workforce development", "training services", "labor market programs"],
  software: ["IT services", "software licensing", "data systems", "cloud services"],
  data: ["analytics", "performance measurement", "evidence-building"],
  climate: ["resilience", "clean energy", "environmental services"],
  manufacturing: ["advanced manufacturing", "supply chain resilience"],
  safety: ["public safety", "risk reduction", "emergency preparedness"],
  training: ["technical assistance", "capacity building", "workforce training"]
};

const prioritySignalTerms = {
  live_performance_events: ["live music performance", "music performance", "musician services", "event entertainment", "concert programming", "public concerts", "festival entertainment", "public event production"],
  active_contracts: ["contract opportunities", "procurement", "solicitation", "bid opportunity"],
  grants_funding: ["grants", "funding opportunity", "grant program", "direct apply"],
  funded_buyers: ["funded buyer", "award recipient", "grantee", "federal award recipient"],
  partners_channels: ["implementation partner", "channel partner", "prime contractor", "subrecipient"],
  policy_signals: ["policy signal", "federal register", "regulatory demand", "agency priority"],
  state_local: ["state procurement", "city procurement", "county procurement", "local government", "state grants"]
};

const priorityOptions = [
  ["live_performance_events", "Live performance / events"],
  ["active_contracts", "Active bids / contracts"],
  ["grants_funding", "Grants / funding"],
  ["funded_buyers", "Funded buyers"],
  ["partners_channels", "Partners / channels"],
  ["policy_signals", "Policy signals"],
  ["state_local", "State / local sources"]
];

const opportunityLaneRules = [
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

const opportunityPlaybooks = [
  {
    playbook_id: "healthcare_rehab_dme",
    name: "Healthcare / Rehab / DME / Medical Supply",
    trigger_industries: ["healthcare", "medical", "rehab", "rehabilitation", "durable medical equipment", "dme"],
    trigger_keywords: [
      "medical",
      "rehab",
      "rehabilitation",
      "orthotic",
      "prosthetic",
      "durable medical equipment",
      "dme",
      "physical therapy",
      "compression",
      "brace",
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
      "VA, prosthetics, and orthotics purchasing": ["VA prosthetics orthotics", "orthotic supplies", "prosthetic supplies", "veteran rehabilitation"],
      "Medical and rehabilitation supply procurement": ["rehabilitation supplies", "physical therapy supplies", "clinical supplies", "durable medical equipment"],
      "Medical retail, distributor, and channel targets": ["medical supply distributor", "rehabilitation supply distributor", "durable medical equipment supplier", "orthotic supply vendor"],
      "Workers' compensation and occupational health": ["workers compensation medical supplies", "occupational health", "return to work"],
      "Aging, disability, and community care": ["disability support services", "mobility support", "Medicaid waiver supports"]
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
    likely_revenue_motions: ["sell_to_agency", "sell_to_funded_buyer", "partner_with_recipient", "bid_on_procurement", "channel_or_program_partner", "monitor_policy"],
    suggested_contact_roles: ["Procurement Specialist", "VA Prosthetics Representative", "Rehab Services Director", "Clinical Supply Manager", "DME Category Manager"],
    report_guidance: "Translate the company into public-sector demand around rehab, DME, orthotic/prosthetic supplies, VA purchasing, clinical supply channels, distributor paths, and funded healthcare buyers."
  },
  {
    playbook_id: "music_arts_creative_economy",
    name: "Music / Arts / Creative Economy / Live Performance",
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
      "City and county live performance budgets": ["live music performance", "music performance", "live music services", "musical performance services", "musical performance", "musician services", "concert programming", "public performance", "public concerts", "community events"],
      "Parks and recreation concerts/events": ["parks recreation concert", "summer concert series", "event entertainment", "performer services"],
      "Arts and culture grants": ["arts grants", "cultural programming", "performing arts services"],
      "School and district arts programming": ["arts education", "teaching artists", "music enrichment"],
      "Creative workforce development": ["creative workforce", "arts workforce", "creative economy workforce"],
      "Tourism and placemaking": ["tourism events", "placemaking arts", "downtown activation"],
      "Downtown revitalization / BID programming": ["downtown activation", "business improvement district events", "public plaza programming", "public space activation", "downtown partnership events", "district event programming", "open streets programming", "night market entertainment", "neighborhood festival programming", "public event production"],
      "Public event production procurement": ["event production services", "event entertainment services", "performing artist services", "artist booking", "festival programming"],
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
    likely_revenue_motions: ["sell_to_agency", "sell_to_funded_buyer", "partner_with_grantee", "bid_on_procurement", "channel_or_program_partner", "monitor_policy"],
    suggested_contact_roles: ["Cultural Affairs Manager", "Arts Program Director", "Parks and Recreation Director", "Events Coordinator", "Tourism Director", "Downtown Partnership Director", "School Arts Coordinator", "Procurement Specialist", "Grants Manager", "Workforce Program Manager"],
    report_guidance: "Translate the company into public-sector demand around cultural programming, artist booking, public events, creative workforce, arts education, tourism, placemaking, and live-performance procurement."
  },
  {
    playbook_id: "education_workforce_training",
    name: "Education / Workforce / Training",
    trigger_industries: ["education workforce", "teacher staffing", "school hiring"],
    trigger_keywords: [
      "teacher",
      "teachers",
      "educator",
      "educators",
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
      "Education workforce grants and technical assistance",
      "Government HR, job board, and recruiting technology procurement",
      "School district procurement and vendor registration",
      "Workforce boards and educator pipeline programs"
    ],
    lane_search_terms: {
      "K-12 hiring, teacher staffing, and educator workforce": ["teacher recruitment", "educator workforce", "school staffing", "substitute teacher staffing", "teacher shortage", "school district hiring"],
      "Education workforce grants and technical assistance": ["education workforce development", "teacher residency", "educator preparation", "school improvement staffing", "state education agency grants"],
      "Government HR, job board, and recruiting technology procurement": ["education recruitment platform", "applicant tracking system", "human resources software", "job board services", "talent acquisition"],
      "School district procurement and vendor registration": ["school district procurement", "education technology procurement", "district vendor registration", "teacher hiring platform"],
      "Workforce boards and educator pipeline programs": ["educator pipeline", "workforce development education", "teacher preparation program", "career pathways education"]
    },
    source_categories_to_activate: ["company_website", "usaspending.gov", "federal_register"],
    planned_source_categories: ["sam.gov", "grants.gov", "department_of_education", "department_of_labor", "state_education_departments", "school_district_procurement", "workforce_boards"],
    public_sector_search_terms: ["teacher recruitment", "educator workforce", "school staffing", "substitute teacher staffing", "teacher shortage", "teacher residency", "education recruitment platform", "school district hiring", "applicant tracking system", "education workforce development", "teacher preparation program", "educator pipeline"],
    likely_revenue_motions: ["sell_to_agency", "sell_to_funded_buyer", "partner_with_grantee", "bid_on_procurement", "channel_or_program_partner"],
    suggested_contact_roles: ["School District HR Director", "Chief Talent Officer", "Recruitment Director", "Superintendent", "State Education Agency Program Manager", "Workforce Program Manager", "Procurement Specialist", "Grants Manager"],
    report_guidance: "Translate the company into public-sector demand around teacher recruitment, educator workforce, school staffing, HR/recruiting technology, workforce boards, and school district procurement."
  }
];

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTerm(text, term) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`).test(text);
}

function isOffVerticalLane(lane, selectedIds) {
  const normalized = lane.toLowerCase();
  if (!selectedIds.has("music_arts_creative_economy") && /music|artist|arts|creative|cultural|entertainment|concert|festival|venue|live event|public event/.test(normalized)) {
    return true;
  }
  if (!selectedIds.has("education_workforce_training") && /teacher|educator|school staffing|recruiting technology|job board|talent acquisition/.test(normalized)) {
    return true;
  }
  if (!selectedIds.has("healthcare_rehab_dme") && /medical|healthcare|clinical|rehab|dme|prosthetic|orthotic|medicare|medicaid|veteran/.test(normalized)) {
    return true;
  }
  return false;
}

function matchPlaybooks(profile, input) {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.products_services || []),
    ...(profile.target_customers || []),
    ...(profile.industries || []),
    ...(profile.keywords || []),
    input?.opportunity_focus,
    input?.include_terms,
    input?.exclude_terms,
    ...(input?.priority_signals || []),
    input?.company_name,
    input?.industry,
    input?.customer_type
  ].filter(Boolean).join(" ").toLowerCase();

  return opportunityPlaybooks
    .map((playbook) => {
      const matchedTerms = unique([...playbook.trigger_industries, ...playbook.trigger_keywords].filter((term) => includesTerm(text, term)));
      const customerMatch = input?.customer_type ? playbook.relevant_customer_types.some((type) => type.toLowerCase() === input.customer_type.toLowerCase()) : false;
      const matchScore = matchedTerms.length * 12 + (customerMatch ? 8 : 0) + 10;
      return { playbook, matchedTerms, matchScore };
    })
    .filter(({ matchedTerms, matchScore }) => matchedTerms.length > 0 && matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore)
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

function applyPlaybooksToProfile(profile, input) {
  const selected = matchPlaybooks(profile, input);
  const definitions = selected.map((match) => opportunityPlaybooks.find((playbook) => playbook.playbook_id === match.playbook_id)).filter(Boolean);
  const selectedIds = new Set(definitions.map((playbook) => playbook.playbook_id));
  const unselectedImplementedPlaybooks = opportunityPlaybooks.filter((playbook) => !selectedIds.has(playbook.playbook_id));
  const excludedLanes = new Set(definitions.length > 0 ? unselectedImplementedPlaybooks.flatMap((playbook) => playbook.opportunity_lanes) : []);
  const excludedSearchTerms = new Set(definitions.length > 0 ? unselectedImplementedPlaybooks.flatMap((playbook) => playbook.public_sector_search_terms) : []);
  const laneSearchTerms = { ...(profile.lane_search_terms || {}) };
  for (const playbook of definitions) {
    for (const [lane, terms] of Object.entries(playbook.lane_search_terms || {})) {
      laneSearchTerms[lane] = unique([...(laneSearchTerms[lane] || []), ...terms]);
    }
  }
  for (const lane of Object.keys(laneSearchTerms)) {
    if (excludedLanes.has(lane) || isOffVerticalLane(lane, selectedIds)) {
      delete laneSearchTerms[lane];
    }
  }

  return {
    ...profile,
    selected_playbooks: selected,
    opportunity_lanes: unique([
      ...(profile.opportunity_lanes || []).filter((lane) => !excludedLanes.has(lane) && !isOffVerticalLane(lane, selectedIds)),
      ...definitions.flatMap((playbook) => playbook.opportunity_lanes)
    ]),
    lane_search_terms: laneSearchTerms,
    public_sector_search_terms: unique([
      ...definitions.flatMap((playbook) => playbook.public_sector_search_terms),
      ...(profile.public_sector_search_terms || []).filter((term) => !excludedSearchTerms.has(term))
    ]).slice(0, 40),
    translated_public_sector_terms: unique([
      ...definitions.flatMap((playbook) => playbook.public_sector_search_terms),
      ...(profile.translated_public_sector_terms || profile.public_sector_search_terms || []).filter((term) => !excludedSearchTerms.has(term))
    ]).slice(0, 40),
    activated_source_categories: unique(definitions.flatMap((playbook) => playbook.source_categories_to_activate)),
    planned_source_categories: unique(definitions.flatMap((playbook) => playbook.planned_source_categories)),
    likely_revenue_motions: unique(definitions.flatMap((playbook) => playbook.likely_revenue_motions)),
    suggested_contact_roles: unique(definitions.flatMap((playbook) => playbook.suggested_contact_roles)),
    report_guidance: definitions.map((playbook) => playbook.report_guidance)
  };
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --ink:#172033; --field:#f5f7fb; --line:#d8dee9; --accent:#1d7a8c; }
    * { box-sizing: border-box; }
    body { margin:0; background:#f7f8fb; color:var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color:var(--accent); text-decoration:none; font-weight:650; }
    .top { background:white; border-bottom:1px solid var(--line); }
    .wrap { max-width:1120px; margin:0 auto; padding:28px 24px; }
    h1 { font-size:40px; line-height:1.1; margin:12px 0; max-width:840px; }
    h2 { margin:0 0 12px; font-size:18px; }
    p { color:#536174; line-height:1.6; }
    .eyebrow { color:var(--accent); text-transform:uppercase; font-size:13px; font-weight:750; letter-spacing:.08em; }
    .grid { display:grid; grid-template-columns:1.1fr .9fr; gap:28px; }
    .card { background:white; border:1px solid var(--line); border-radius:8px; padding:22px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
    form { display:grid; gap:18px; }
    label { display:grid; gap:8px; font-size:14px; font-weight:650; }
    input, select { width:100%; border:1px solid var(--line); border-radius:6px; padding:12px; background:var(--field); font:inherit; }
    button, .button { border:0; border-radius:6px; background:var(--accent); color:white; padding:12px 14px; font-weight:750; cursor:pointer; display:inline-block; }
    .row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .chip { background:var(--field); border-radius:6px; padding:7px 9px; font-size:13px; color:var(--ink); }
    .status { display:inline-block; border:1px solid var(--line); border-radius:6px; padding:7px 9px; color:#536174; background:white; }
    .error { background:#fff1f2; border:1px solid #fecdd3; color:#be123c; border-radius:6px; padding:10px; }
    pre { overflow:auto; max-height:520px; background:#101827; color:#f8fafc; border-radius:6px; padding:16px; font-size:12px; line-height:1.5; }
    .list { display:grid; gap:14px; }
    .split { display:grid; grid-template-columns:1fr auto; gap:16px; align-items:start; }
    @media (max-width: 820px) { .grid, .row, .split { grid-template-columns:1fr; } h1 { font-size:32px; } }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readDb() {
  try {
    const db = JSON.parse(await fs.readFile(dataPath, "utf8"));
    return {
      scans: db.scans || [],
      company_profiles: db.company_profiles || [],
      source_results: db.source_results || [],
      opportunities: db.opportunities || [],
      scan_opportunities: db.scan_opportunities || [],
      report_feedback: db.report_feedback || [],
      opportunity_enrichment_requests: db.opportunity_enrichment_requests || []
    };
  } catch {
    return { scans: [], company_profiles: [], source_results: [], opportunities: [], scan_opportunities: [], report_feedback: [], opportunity_enrichment_requests: [] };
  }
}

async function writeDb(db) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(db, null, 2));
}

function normalizeUrl(value) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(match?.[1] || "");
}

async function scrapeCompanyWebsite(startUrl) {
  const base = new URL(startUrl);
  const candidates = likelyPaths.map((pathname) => new URL(pathname, base.origin).toString());
  const visited = new Set();
  const pages = [];
  let rawText = "";

  for (const url of candidates) {
    if (visited.has(url) || pages.length >= maxPages || rawText.length >= maxChars) continue;
    visited.add(url);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "PolicyOpportunityScannerMVP/0.1" }
      });
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("text/html")) continue;

      const html = await response.text();
      const text = stripTags(html).slice(0, 10000);
      if (text.length < 120) continue;

      const page = { url, title: extractTitle(html), text };
      pages.push(page);
      rawText = `${rawText}\n\nURL: ${page.url}\nTITLE: ${page.title}\n${page.text}`.slice(0, maxChars);
    } catch {
      continue;
    }
  }

  return { pages, rawText: rawText.trim() };
}

function pickTerms(text, max = 18) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "your", "our", "are", "you", "not", "all", "can", "has", "have", "will", "more", "about", "into", "their"]);
  const counts = new Map();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z-]{3,}/g)) {
    const word = match[0].replace(/-$/, "");
    if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([word]) => word);
}

function phraseTerms(value = "") {
  return unique(
    String(value)
      .split(/[\n,;]+/)
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 3)
  ).slice(0, 24);
}

function inferPublicSectorTerms(keywords, industry, input) {
  const haystack = `${keywords.join(" ")} ${industry || ""} ${input ? intentText(input) : ""}`.toLowerCase();
  const terms = new Set();
  if (input) {
    intentTerms(input).forEach((term) => terms.add(term));
  }
  for (const [needle, mapped] of Object.entries(publicSectorTermMap)) {
    if (haystack.includes(needle)) mapped.forEach((term) => terms.add(term));
  }
  keywords.slice(0, 8).forEach((keyword) => terms.add(keyword));
  terms.add("procurement");
  terms.add("federal funding");
  terms.add("state programs");
  return [...terms].slice(0, 16);
}

function intentText(input) {
  return [input.opportunity_focus, input.include_terms, input.exclude_terms, ...(input.priority_signals || [])].filter(Boolean).join(" ");
}

function intentTerms(input) {
  return unique([
    ...phraseTerms(input.include_terms || ""),
    ...(input.priority_signals || []).flatMap((signal) => prioritySignalTerms[signal] || []),
    ...pickTerms(input.opportunity_focus || "", 10)
  ]).slice(0, 24);
}

function excludeTerms(input) {
  return unique(phraseTerms(input.exclude_terms || ""));
}

function inferCodes(keywords, industry, kind) {
  const haystack = `${keywords.join(" ")} ${industry || ""}`.toLowerCase();
  const values = [];
  if (/health|medical|clinical/.test(haystack)) {
    values.push(kind === "naics" ? "621999 - Other Ambulatory Health Care Services" : "29-0000 - Healthcare Occupations");
  }
  if (/education|school|student/.test(haystack)) {
    values.push(kind === "naics" ? "611710 - Educational Support Services" : "25-0000 - Educational Instruction");
  }
  if (/software|data|cloud|analytics|platform/.test(haystack)) {
    values.push(kind === "naics" ? "541511 - Custom Computer Programming Services" : "15-1252 - Software Developers");
  }
  if (/workforce|training|labor/.test(haystack)) {
    values.push(kind === "naics" ? "611430 - Professional and Management Development Training" : "13-1151 - Training and Development Specialists");
  }
  return values;
}

function inferPolicyCategories(terms) {
  const joined = terms.join(" ").toLowerCase();
  const categories = new Set();
  if (/health|medical|clinical|patient|reimbursement/.test(joined)) categories.add("healthcare_reimbursement");
  if (/education|student|school/.test(joined)) categories.add("education_funding");
  if (/workforce|training|labor/.test(joined)) categories.add("workforce_development");
  if (/software|data|cloud|analytics|it/.test(joined)) categories.add("government_it_modernization");
  if (categories.size === 0) categories.add("public_procurement");
  return [...categories];
}

function collectSearchTerms(profile, limit = 12) {
  const terms = new Set();
  for (const lane of profile.opportunity_lanes || []) {
    for (const term of profile.lane_search_terms?.[lane] || []) terms.add(term);
  }
  for (const term of profile.public_sector_search_terms || []) terms.add(term);
  for (const term of profile.keywords || []) terms.add(term);
  return [...terms].filter((term) => term.length >= 4).slice(0, limit);
}

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

function normalizeSamTerm(term) {
  return String(term || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isUsefulSamTerm(term) {
  const normalized = normalizeSamTerm(term);
  if (normalized.length < 5 || genericSamTerms.has(normalized)) return false;
  const wordCount = normalized.split(" ").length;
  const hasHighIntentWord = highIntentSamWords.some((word) => normalized.includes(word));
  return wordCount >= 2 || hasHighIntentWord;
}

function collectSamSearchTerms(profile, limit = 16) {
  const terms = new Set();
  for (const lane of profile.opportunity_lanes || []) {
    for (const term of profile.lane_search_terms?.[lane] || []) {
      if (isUsefulSamTerm(term)) terms.add(term);
    }
  }
  for (const term of profile.public_sector_search_terms || []) {
    if (isUsefulSamTerm(term)) terms.add(term);
  }
  return [...terms]
    .sort((a, b) => {
      const aScore = highIntentSamWords.filter((word) => normalizeSamTerm(a).includes(word)).length;
      const bScore = highIntentSamWords.filter((word) => normalizeSamTerm(b).includes(word)).length;
      return bScore - aScore || a.length - b.length;
    })
    .slice(0, limit);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const strongEvidenceTerms = [
  "education",
  "school",
  "schools",
  "school district",
  "district",
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
  "sports medicine",
  "supplier",
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
  "industrial base expansion"
  ,"environmental quality",
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

const laneMatchers = [
  { lane: "City, state, and public venue entertainment procurement", terms: ["musical performance", "live music", "event entertainment", "festival entertainment", "concert programming", "performer services", "public event production", "venue entertainment"] },
  { lane: "Creative workforce and music-industry talent networks", terms: ["creative economy workforce", "arts workforce", "music workforce", "artist services", "creative workforce", "entertainment workforce"] },
  { lane: "Cultural programming, live events, and public arts buyers", terms: ["cultural programming", "performing arts", "music education", "public arts program", "live entertainment", "event production", "arts grants"] },
  { lane: "K-12 hiring, teacher staffing, and educator workforce", terms: ["teacher", "teachers", "educator", "school district", "substitute teacher", "teacher shortage", "school staffing"] },
  { lane: "Education workforce grants and technical assistance", terms: ["education workforce", "teacher residency", "educator preparation", "school improvement", "state education agency"] },
  { lane: "Government HR, job board, and recruiting technology procurement", terms: ["recruiting software", "applicant tracking", "human resources", "job board", "talent acquisition", "recruitment platform"] },
  { lane: "VA, prosthetics, and orthotics purchasing", terms: ["veteran", "veterans", "department of veterans affairs", "prosthetic", "orthotic", "visn"] },
  { lane: "DME, Medicare, and reimbursement infrastructure", terms: ["durable medical equipment", "dmepos", "medicare", "medicaid", "cms", "reimbursement"] },
  { lane: "Medical and rehabilitation supply procurement", terms: ["medical supplies", "rehabilitation supplies", "physical therapy", "clinical supplies"] },
  { lane: "Medical retail, distributor, and channel targets", terms: ["distribution", "distributor", "supplier", "supply", "vendor", "laboratories", "medical retail", "medical supply"] },
  { lane: "Workers' compensation and occupational health", terms: ["workers compensation", "occupational health", "workplace injury", "return to work"] },
  { lane: "Aging, disability, and community care", terms: ["aging", "disability", "mobility", "home health", "community care"] },
  { lane: "Public safety and first responder health", terms: ["public safety", "first responder", "police", "fire", "ems"] },
  { lane: "School, college, and athletics injury recovery", terms: ["athletic", "sports medicine", "student athlete", "college athletics"] }
];

function evidenceText(...parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function hasStrongEvidence(text) {
  return strongEvidenceTerms.some((term) => text.includes(term));
}

function hasNegativeEvidence(text) {
  return negativeEvidenceTerms.some((term) => text.includes(term));
}

function hasProfileNegativeEvidence(profile, text) {
  return (profile.negative_keywords || [])
    .map((term) => String(term).toLowerCase().trim())
    .filter((term) => term.length >= 3)
    .some((term) => text.includes(term));
}

function isInfrastructureSignal(text) {
  return infrastructureTerms.some((term) => text.includes(term));
}

function evidenceScore(text, query) {
  let score = 42;
  const normalizedQuery = query.toLowerCase();
  if (text.includes(normalizedQuery)) score += 18;
  for (const term of strongEvidenceTerms) {
    if (text.includes(term)) score += 4;
  }
  if (hasNegativeEvidence(text)) score -= 35;
  if (isInfrastructureSignal(text)) score -= 22;
  return clampScore(score);
}

function inferSignalLane(text, fallback = "General public-sector signal") {
  const match = laneMatchers.find((matcher) => matcher.terms.some((term) => text.includes(term)));
  return match?.lane || fallback;
}

function formatMoney(value) {
  if (!value) return "undisclosed amount";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function isEducationWorkforceProfile(profile) {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.industries || []),
    ...(profile.keywords || []),
    ...(profile.public_sector_search_terms || []),
    ...(profile.opportunity_lanes || [])
  ].join(" ").toLowerCase();
  return /schoolgig|teacher|teachers|educator|educators|substitute|teacher shortage|teacher recruitment|school staffing|school district hiring|hiring platform|recruiting|recruitment|job board|talent acquisition|applicant tracking/.test(text);
}

function isEducationWorkforceFit(text) {
  return /teacher|teachers|educator|educators|principal|principals|substitute teacher|teacher shortage|teacher recruitment|teacher residency|school staffing|school workforce|school district recruiting|applicant tracking|human resources software|job board|talent acquisition|recruiting platform/.test(text);
}

function isEducationDomainMismatch(text) {
  const healthOrCrisis = /behavioral health|mental health|suicide|988|crisis|clinical|clinician|therapist|medicaid|healthcare|department of health|substance use|telehealth/.test(text);
  const justiceOrReentry = /prison|jail|incarcerated|reentry|correctional|justice center|law enforcement custody/.test(text);
  return healthOrCrisis || justiceOrReentry;
}

function isCreativeWorkforceProfile(profile) {
  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.industries || []),
    ...(profile.keywords || []),
    ...(profile.public_sector_search_terms || []),
    ...(profile.opportunity_lanes || [])
  ].join(" ").toLowerCase();
  return /jammcard|music|musician|artist|artists|creative|entertainment|performing arts|live event|cultural|venue|production/.test(text);
}

function isCreativeWorkforceFit(text) {
  return /music|musician|musicians|artist|artists|arts|creative economy|creative workforce|arts workforce|performing arts|live entertainment|event production|cultural programming|music education|public arts|festival|venue|musical performance|live music|performer services|performers|concert|event entertainment|public event|tourism/.test(text);
}

function isCreativeDomainMismatch(text) {
  return /teacher shortage|teacher residency|school staffing|substitute teacher|educator workforce|student athlete|medical supplies|medicaid|medicare|behavioral health|mental health|correctional|reentry|environmental quality|environmental protection|water quality|air quality|artificial intelligence|collaborative research|intensive care|patient recovery|conference:|computation for music/.test(text);
}

function creativeLaneFor(text, fallback) {
  if (/business improvement district|downtown partnership|downtown activation|public plaza|public space activation|open streets|night market|neighborhood festival/.test(text)) return "Downtown revitalization / BID programming";
  if (/teaching artist|arts education|music enrichment|school arts|artist residency/.test(text)) return "School and district arts programming";
  if (/creative workforce|arts workforce|artist services|creative economy/.test(text)) return "Creative workforce development";
  if (/tourism|placemaking/.test(text)) return "Tourism and placemaking";
  if (/concert|live music|musical performance|event entertainment|performer services|public event/.test(text)) return "City and county live performance budgets";
  if (/arts grant|cultural programming|performing arts|public arts/.test(text)) return "Arts and culture grants";
  return fallback;
}

async function searchUsaSpendingAwards(query) {
  const endDate = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const awardTypeCodes of [["A", "B", "C", "D"], ["02", "03", "04", "05", "F001", "F002"]]) {
    const response = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          keywords: [query],
          award_type_codes: awardTypeCodes,
          time_period: [{ start_date: "2024-01-01", end_date: endDate }],
          award_amounts: [{ lower_bound: 10000 }]
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
    if (!response.ok) continue;
    const data = await response.json();
    results.push(...(data?.results || []));
  }
  return results;
}

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

async function searchUsaSpending(profile) {
  const signals = [];
  const seen = new Set();
  const perQueryCount = new Map();
  const educationWorkforceProfile = isEducationWorkforceProfile(profile);
  const creativeWorkforceProfile = isCreativeWorkforceProfile(profile);
  const terms = creativeWorkforceProfile
    ? unique([...creativeHighIntentTerms, ...collectSearchTerms(profile, 40)]).slice(0, 45)
    : collectSearchTerms(profile, 18);
  for (const term of terms) {
    const awards = await searchUsaSpendingAwards(term);
    for (const award of awards) {
      const awardId = award["Award ID"] || `${term}-${award["Recipient Name"]}`;
      if (seen.has(awardId)) continue;
      if ((perQueryCount.get(term) || 0) >= 2) continue;
      seen.add(awardId);

      const amount = formatMoney(award["Award Amount"]);
      const recipient = award["Recipient Name"] || "Recipient not listed";
      const agency = award["Awarding Agency"] || "Agency not listed";
      const description = award.Description || "No description available.";
      const sourceText = evidenceText(recipient, agency, description, award["Award Type"]);
      const text = evidenceText(term, sourceText);
      if (!hasStrongEvidence(sourceText) || hasNegativeEvidence(sourceText) || hasProfileNegativeEvidence(profile, sourceText)) continue;
      if (educationWorkforceProfile && (!isEducationWorkforceFit(sourceText) || isEducationDomainMismatch(sourceText))) continue;
      if (creativeWorkforceProfile && (!isCreativeWorkforceFit(sourceText) || isCreativeDomainMismatch(sourceText))) continue;
      const relevanceScore = isInfrastructureSignal(text) ? Math.min(evidenceScore(text, term), 64) : evidenceScore(text, term);
      const lane = isInfrastructureSignal(text)
        ? "DME, Medicare, and reimbursement infrastructure"
        : creativeWorkforceProfile
          ? creativeLaneFor(text, inferSignalLane(text, "Public-sector funded-buyer signal"))
          : inferSignalLane(text, "Public-sector funded-buyer signal");
      const revenuePathway = isInfrastructureSignal(text) ? "monitor_policy" : text.includes("department of veterans affairs") || text.includes("prosthetic") || text.includes("orthotic") || text.includes("school district") ? "sell_to_agency" : "sell_to_grantee";
      const infrastructure = isInfrastructureSignal(text);
      signals.push({
        opportunity_title: `${recipient} received ${amount}: ${lane}`,
        source_type: "historical_award",
        source_name: "USAspending.gov",
        source_url: award["Award ID"] ? `https://www.usaspending.gov/award/${encodeURIComponent(award["Award ID"])}` : "https://www.usaspending.gov/search",
        agency_or_funder: agency,
        deadline: award["End Date"] || "",
        geography: award["Place of Performance State Code"] || "",
        external_evidence_summary: description,
        why_it_matters: "This is evidence that public money has flowed into an adjacent category, agency, or recipient market.",
        who_benefits: recipient,
        likely_buyer_or_partner: recipient,
        revenue_pathway: revenuePathway,
        relevance_score: relevanceScore,
        novelty_score: clampScore(64 + (relevanceScore > 70 ? 12 : 0)),
        confidence_score: clampScore(56 + (text.includes(term.toLowerCase()) ? 12 : 0) + (agency !== "Agency not listed" ? 8 : 0)),
        reasoning: [`Matched search term: ${term}`, `Inferred lane: ${lane}`, "USAspending records historical federal award activity.", "Treat as a funded-buyer or market-map signal, not proof of eligibility."],
        recommended_action: infrastructure ? `Use this as reimbursement/procurement infrastructure context, not a near-term product buyer. Review ${agency} for DME policy and contractor ecosystem signals.` : `Review ${recipient} and ${agency} under the "${lane}" pathway; look for procurement contacts, grantee relationships, or similar buyers.`,
        actionability: infrastructure ? "unlikely" : "maybe",
        actionability_reason: infrastructure ? "Infrastructure or reimbursement-system context, not a direct buyer/channel the company can pursue." : "Adjacent public-sector spending that may indicate a buyer, partner, or funded-recipient pathway.",
        best_next_step: infrastructure ? "Do not surface as a lead; use only for background market mapping." : "Validate the buying office and determine whether outreach should go to the recipient, agency procurement contact, or channel partner.",
        human_review_required: true,
        query_used: term,
        raw_json: award
      });
      perQueryCount.set(term, (perQueryCount.get(term) || 0) + 1);
      if (signals.length >= (creativeWorkforceProfile ? 28 : 14)) return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
    }
  }
  return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
}

async function searchFederalRegisterDocs(query) {
  const params = new URLSearchParams({
    "conditions[term]": query,
    "conditions[publication_date][gte]": "2023-01-01",
    order: "newest",
    per_page: "3"
  });
  const response = await fetch(`https://www.federalregister.gov/api/v1/documents.json?${params}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data?.results || [];
}

async function searchFederalRegister(profile) {
  const signals = [];
  const seen = new Set();
  const creativeWorkforceProfile = isCreativeWorkforceProfile(profile);
  for (const term of collectSearchTerms(profile, 8)) {
    const docs = await searchFederalRegisterDocs(term);
    for (const doc of docs) {
      const relevantText = `${doc.title || ""} ${doc.abstract || ""} ${(doc.agencies || []).map((item) => item.name).join(" ")}`.toLowerCase();
      if (creativeWorkforceProfile) {
        const hasCreativeFit = /music|musician|artist|artists|arts|cultural|creative|performing arts|live entertainment|event production|concert|festival|public arts|national endowment for the arts|national foundation on the arts and the humanities|smithsonian/.test(relevantText);
        const wrongDomain = /medicare|medicaid|cms|hospital|healthcare|clinical|patient|transplant|behavioral health|mental health/.test(relevantText);
        if (!hasCreativeFit || wrongDomain) continue;
      }
      const hasQueryWord = term.toLowerCase().split(/\s+/).some((word) => word.length > 4 && relevantText.includes(word));
      const hasAgencyFit = creativeWorkforceProfile ? /arts|humanities|smithsonian|museum|parks|tourism|cultural|education/.test(relevantText) : /health|medicare|medicaid|veteran|labor|occupational safety|cms/.test(relevantText);
      if (hasNegativeEvidence(relevantText) || hasProfileNegativeEvidence(profile, relevantText) || !hasStrongEvidence(relevantText) || !hasQueryWord || !hasAgencyFit) continue;
      const url = doc.html_url || "https://www.federalregister.gov/documents/search";
      if (seen.has(url)) continue;
      seen.add(url);
      const agency = (doc.agencies || []).map((item) => item.name).filter(Boolean).join(", ");
      const summary = doc.abstract || doc.title || "Federal Register document matched this search term.";
      const text = evidenceText(term, doc.title, summary, agency, doc.type);
      const relevanceScore = evidenceScore(text, term);
      const lane = inferSignalLane(text, "Policy and regulatory demand signal");
      signals.push({
        opportunity_title: doc.title || `Federal Register policy signal for ${term}`,
        source_type: "policy_signal",
        source_name: "Federal Register",
        source_url: url,
        agency_or_funder: agency,
        deadline: "",
        geography: "Federal",
        external_evidence_summary: summary,
        why_it_matters: "Federal Register activity can signal agency priorities, regulatory changes, program design, or future demand before a procurement or grant is obvious.",
        who_benefits: "Companies monitoring policy-created demand",
        likely_buyer_or_partner: agency,
        revenue_pathway: "monitor_policy",
        relevance_score: relevanceScore,
        novelty_score: clampScore(70 + (relevanceScore > 70 ? 8 : 0)),
        confidence_score: clampScore(50 + (agency ? 10 : 0) + (summary.toLowerCase().includes(term.toLowerCase()) ? 10 : 0)),
        reasoning: [`Matched search term: ${term}`, `Inferred lane: ${lane}`, `Document type: ${doc.type || "Federal Register document"}`, "Treat as a demand signal, not a direct buying opportunity."],
        recommended_action: `Review this under the "${lane}" pathway and decide whether it implies future procurement, reimbursement, compliance, or partner demand.`,
        actionability: "unlikely",
        actionability_reason: "Policy activity can explain demand but is not enough by itself to recommend direct outreach.",
        best_next_step: "Use as context only unless paired with an active contract, grant, buyer, or specific agency program.",
        human_review_required: true,
        query_used: term,
        raw_json: doc
      });
      if (signals.length >= 6) return signals;
    }
  }
  return signals;
}

function isSamGovConfigured() {
  return Boolean(process.env.SAM_API_KEY);
}

let samGovLastError = "";

function formatSamDate(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function samPostedFromDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  date.setDate(date.getDate() + 1);
  return date;
}

function samOpportunityUrl(item) {
  if (item.uiLink && item.uiLink !== "null") return item.uiLink;
  if (item.noticeId) return `https://sam.gov/opp/${encodeURIComponent(item.noticeId)}/view`;
  return "https://sam.gov/content/opportunities";
}

function samAgencyName(item) {
  return item.fullParentPathName || [item.department, item.subTier, item.office].filter(Boolean).join(" / ") || "Agency not listed";
}

function samPrimaryContact(item) {
  const contact = item.pointOfContact?.[0];
  if (!contact) return "";
  return [contact.title, contact.fullName || contact.fullname, contact.email, contact.phone].filter(Boolean).join(" | ");
}

function samSourceType(item) {
  const type = `${item.type || ""} ${item.baseType || ""}`.toLowerCase();
  if (type.includes("award")) return "funded_buyer";
  if (type.includes("sources sought") || type.includes("special notice")) return "procurement_category";
  return "active_contract";
}

function samRevenuePathway(item) {
  const type = `${item.type || ""} ${item.baseType || ""}`.toLowerCase();
  if (type.includes("sources sought") || type.includes("special notice")) return "sell_to_agency";
  if (type.includes("award")) return "sell_to_grantee";
  return "procurement_bid";
}

async function searchSamGovTerm(term, ptypes) {
  if (!process.env.SAM_API_KEY) return [];
  const results = [];
  for (const ptype of ptypes) {
    const params = new URLSearchParams({
      api_key: process.env.SAM_API_KEY,
      postedFrom: formatSamDate(samPostedFromDate()),
      postedTo: formatSamDate(new Date()),
      title: term,
      limit: "5",
      offset: "0",
      ptype
    });
    const response = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      if (response.status === 429) {
        samGovLastError = "Rate limited by SAM.gov; retry after the API reset window.";
      } else {
        samGovLastError = `SAM.gov returned ${response.status}.`;
      }
      continue;
    }
    const data = await response.json();
    results.push(...(data?.opportunitiesData || []));
  }
  return results;
}

async function searchSamGov(profile) {
  if (!isSamGovConfigured()) return [];
  const terms = collectSamSearchTerms(profile, 18);
  const signals = [];
  const seen = new Set();
  for (const term of terms) {
    const opportunities = [
      ...(await searchSamGovTerm(term, ["o", "k", "r", "s", "p"])),
      ...(await searchSamGovTerm(term, ["a"]))
    ];
    for (const item of opportunities) {
      const id = item.noticeId || item.solicitationNumber || `${term}-${item.title}`;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const agency = samAgencyName(item);
      const sourceType = samSourceType(item);
      const contact = samPrimaryContact(item);
      const summary = [
        item.title,
        item.type,
        item.baseType,
        item.typeOfSetAsideDescription,
        item.naicsCode ? `NAICS ${item.naicsCode}` : "",
        item.classificationCode ? `PSC ${item.classificationCode}` : "",
        item.responseDeadLine ? `Response deadline ${item.responseDeadLine}` : "",
        contact ? `Contact ${contact}` : ""
      ].filter(Boolean).join(" | ");
      const text = evidenceText(term, summary, agency);
      if (!hasStrongEvidence(text) || hasNegativeEvidence(text) || hasProfileNegativeEvidence(profile, text)) continue;
      const relevanceScore = evidenceScore(text, term);
      if (relevanceScore < 58) continue;
      const lane = inferSignalLane(text, "Active public procurement opportunity");
      const isActive = item.active === "Yes";
      const isBidLike = sourceType === "active_contract" || sourceType === "procurement_category";
      signals.push({
        opportunity_title: `${item.type || item.baseType || "SAM.gov opportunity"}: ${item.title || "Untitled SAM.gov opportunity"} (${lane})`,
        source_type: sourceType,
        source_name: "SAM.gov",
        source_url: samOpportunityUrl(item),
        agency_or_funder: agency,
        deadline: item.responseDeadLine || "",
        geography: item.placeOfPerformance?.state?.code || item.placeOfPerformance?.state?.name || "Federal",
        external_evidence_summary: summary || "SAM.gov opportunity matched this public-sector search strategy.",
        why_it_matters: isBidLike ? "SAM.gov is an active procurement source, so this may represent a near-term bid or buying-office pathway." : "SAM.gov activity can reveal current procurement demand, award patterns, sources sought notices, or market research.",
        who_benefits: profile.company_name,
        likely_buyer_or_partner: agency,
        revenue_pathway: samRevenuePathway(item),
        relevance_score: relevanceScore,
        novelty_score: clampScore(72 + (sourceType === "active_contract" ? 10 : 0)),
        confidence_score: clampScore(62 + (isActive ? 10 : 0) + (item.responseDeadLine ? 8 : 0) + (contact ? 4 : 0)),
        reasoning: [`Matched search term: ${term}`, `Inferred lane: ${lane}`, `SAM.gov notice type: ${item.type || item.baseType || "Opportunity"}`, `SAM.gov active flag: ${item.active || "Unknown"}`, "Treat active solicitations and sources-sought notices as buyer/procurement pathways."],
        recommended_action: isBidLike ? `Review the SAM.gov notice and validate whether the company can bid directly, partner, or contact the buying office under the "${lane}" pathway.` : `Use this SAM.gov notice to identify the buying office, funded buyer, or similar active procurement pattern under the "${lane}" pathway.`,
        actionability: isActive && isBidLike && relevanceScore >= 70 ? "yes" : "maybe",
        actionability_reason: isActive && isBidLike && relevanceScore >= 70 ? "Active or recent SAM.gov procurement activity in an adjacent category." : "SAM.gov procurement activity may indicate buyer demand, but fit and eligibility need validation.",
        best_next_step: contact ? `Open the SAM.gov notice, review deadline/eligibility, then validate the listed contact: ${contact}.` : "Open the SAM.gov notice, review deadline/eligibility, and identify the contracting officer or program office.",
        human_review_required: true,
        query_used: term,
        raw_json: { ...item, sam_query_terms: terms }
      });
      if (signals.length >= 12) return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
    }
  }
  return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
}

async function searchGrantsGovTerm(term) {
  const response = await fetch("https://api.grants.gov/v1/api/search2", {
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
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data?.data?.oppHits || [];
}

async function fetchGrantsGovOpportunity(id) {
  const response = await fetch("https://api.grants.gov/v1/api/fetchOpportunity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId: Number(id) })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.data || null;
}

function isDirectGrantApplicantFit(detail) {
  const applicantText = (detail?.synopsis?.applicantTypes || []).map((item) => item.description || "").join(" ").toLowerCase();
  return /small business|business|for profit|private institution|individual/.test(applicantText);
}

function grantsGovUrl(id) {
  return id ? `https://www.grants.gov/search-results-detail/${encodeURIComponent(String(id))}` : "https://www.grants.gov/search-grants";
}

function isCreativeGrantProfile(profile) {
  const text = [profile.company_name, profile.summary, ...(profile.public_sector_search_terms || []), ...(profile.opportunity_lanes || []), ...(profile.keywords || [])].join(" ").toLowerCase();
  return /jammcard|music|musician|artist|arts|creative|entertainment|performing arts|concert|festival|cultural|event/.test(text);
}

function isCreativeGrantFit(text) {
  return /arts|artist|artists|creative|cultural|culture|music|musician|performing arts|performance|festival|concert|talent program|public diplomacy|cultural affairs|creative tech|nea grants/.test(text);
}

function isCreativeGrantMismatch(text) {
  return /family planning|public health|health services|clinical trials|behavioral and social sciences|nih|national institutes of health|information and referral|qubit|autonomous maneuver|tactical behaviors|army|defense research|nasa|murep|sustainability and innovation collaborative/.test(text);
}

function isPastGrantDeadline(deadline) {
  const match = String(deadline || "").match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return /\b202[0-5]\b/.test(String(deadline || ""));
  const iso = `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return iso < "2026-06-30";
}

async function searchGrantsGov(profile) {
  const terms = collectSearchTerms(profile, 18);
  const creativeProfile = isCreativeGrantProfile(profile);
  const signals = [];
  const seen = new Set();
  for (const term of terms) {
    const hits = await searchGrantsGovTerm(term);
    for (const hit of hits) {
      const id = hit.id;
      if (!id || seen.has(String(id))) continue;
      seen.add(String(id));
      const detail = await fetchGrantsGovOpportunity(id);
      const synopsis = detail?.synopsis || {};
      const title = detail?.opportunityTitle || hit.title || "Untitled Grants.gov opportunity";
      const agency = synopsis.agencyName || hit.agencyName || detail?.owningAgencyCode || hit.agencyCode || "Agency not listed";
      const description = synopsis.synopsisDesc || title;
      const applicantTypes = (synopsis.applicantTypes || []).map((item) => item.description).filter(Boolean).join(", ");
      const fundingCategories = (synopsis.fundingActivityCategories || []).map((item) => item.description).filter(Boolean).join(", ");
      const awardRange = synopsis.awardFloor && synopsis.awardCeiling ? `Award range ${synopsis.awardFloor}-${synopsis.awardCeiling}` : synopsis.awardCeiling ? `Award ceiling ${synopsis.awardCeiling}` : "";
      const sourceText = evidenceText(title, agency, description, applicantTypes, fundingCategories, awardRange);
      if (!hasStrongEvidence(sourceText) || hasNegativeEvidence(sourceText) || hasProfileNegativeEvidence(profile, sourceText)) continue;
      const relevanceScore = evidenceScore(sourceText, term);
      if (relevanceScore < 58) continue;
      const directApply = isDirectGrantApplicantFit(detail);
      const lane = inferSignalLane(sourceText, "Grant and funding opportunity");
      const contactName = synopsis.agencyContactName || "";
      const contactEmail = synopsis.agencyContactEmail || "";
      const contactPhone = synopsis.agencyContactPhone || "";
      const deadline = hit.closeDate || synopsis.responseDateDesc || "";
      if (deadline && isPastGrantDeadline(deadline)) continue;
      if (creativeProfile && (!isCreativeGrantFit(sourceText) || isCreativeGrantMismatch(sourceText))) continue;
      signals.push({
        opportunity_title: `Grants.gov ${hit.oppStatus || "opportunity"}: ${title}`,
        source_type: "active_grant",
        source_name: "Grants.gov",
        source_url: grantsGovUrl(id),
        agency_or_funder: agency,
        deadline,
        geography: "Federal",
        external_evidence_summary: [description, awardRange, applicantTypes ? `Eligible applicants: ${applicantTypes}` : ""].filter(Boolean).join(" | "),
        why_it_matters: directApply ? "This is an active or forecasted grant opportunity where the company may be able to evaluate direct eligibility." : "This is an active or forecasted funding signal that may create funded buyer, grantee, partner, or program demand.",
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
          directApply ? "Treat the agency contact as a program/eligibility contact." : "Treat this as a funded-buyer or partner signal; do not treat the grant contact as the sales buyer."
        ],
        recommended_action: directApply ? `Review eligibility and contact the Grants.gov program contact for fit under the "${lane}" pathway.` : `Track likely grantees and eligible applicants under the "${lane}" pathway; use the agency contact for program questions, not as the sales decision-maker.`,
        actionability: directApply && relevanceScore >= 70 ? "yes" : "maybe",
        actionability_reason: directApply ? "Active grant opportunity with an agency program contact; direct eligibility still needs validation." : "Active funding signal that may create downstream buyers or partners, but the sales path depends on identifying applicants or recipients.",
        best_next_step: contactEmail ? `Use the listed Grants.gov program contact for eligibility/program questions only: ${[contactName, contactEmail, contactPhone].filter(Boolean).join(" | ")}.` : "Review the grant and identify likely eligible applicants, future recipients, or program partners.",
        human_review_required: true,
        query_used: term,
        raw_json: {
          search_hit: hit,
          detail,
          source_contact_role: "grant_program_contact",
          pointOfContact: contactName || contactEmail || contactPhone ? [{ fullName: contactName, title: "Grant Program Contact", email: contactEmail, phone: contactPhone }] : []
        }
      });
      if (signals.length >= 10) return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
    }
  }
  return signals.sort((a, b) => b.relevance_score + b.confidence_score - (a.relevance_score + a.confidence_score));
}

const stateLocalPortals = [
  ["nyc-passport", "NYC PASSPort Public Solicitations", "New York City", "city_county_procurement", "https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public", /music|artist|arts|cultural|event|performance|tourism|placemaking/i, ["Agency Chief Contracting Officer", "Cultural Affairs Program Manager", "Events or Public Programming Lead"]],
  ["seattle-opengov", "City of Seattle Procurement Portal", "Seattle, WA", "city_county_procurement", "https://procurement.opengov.com/portal/seattle", /music|artist|arts|cultural|event|performance|parks|tourism|placemaking|education|workforce/i, ["Procurement Contact", "Parks and Recreation Events Lead", "Arts and Culture Program Manager"]],
  ["la-ramp", "Los Angeles RAMP Opportunities", "Los Angeles, CA", "city_county_procurement", "https://www.rampla.org/s/", /music|artist|arts|cultural|event|performance|tourism|placemaking|education|workforce/i, ["Department Program Manager", "Contract Administrator", "Cultural Affairs or Recreation Lead"]],
  ["ca-eprocure", "California eProcure Event Search", "California", "state_procurement", "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx", /health|medical|rehab|education|workforce|music|arts|event|training|supplier|services/i, ["State Procurement Officer", "Department Program Manager", "Category Buyer"]],
  ["wa-webs", "Washington WEBS Bid Opportunities", "Washington", "state_procurement", "https://pr-webs-vendor.des.wa.gov/", /health|medical|rehab|education|workforce|music|arts|event|training|supplier|services/i, ["State Buyer", "Agency Program Manager", "Procurement Coordinator"]],
  ["nasaa-directory", "State Arts Agency Directory", "All states", "state_arts_councils", "https://nasaa-arts.org/state-arts-agencies/saa-directory/", /music|artist|arts|cultural|performance|creative|festival|tourism|placemaking/i, ["Arts Program Director", "Grants Manager", "Creative Economy Program Lead"]],
  ["opengov-portal-network", "OpenGov Procurement Portal Network", "State and local", "city_county_procurement", "https://procurement.opengov.com/portal", /procurement|bid|services|event|education|training|medical|supplier|music|arts|workforce/i, ["Procurement Specialist", "Department Program Owner", "Vendor Registration Contact"]]
];

function stateLocalRequested(profile) {
  const categories = [...(profile.activated_source_categories || []), ...(profile.planned_source_categories || [])].join(" ");
  return /state|local|city|county|school_district|procurement|parks|tourism|arts_council|education_department|workforce_board/i.test(categories);
}

function stateLocalProfileText(profile) {
  return [
    profile.company_name,
    profile.summary,
    ...(profile.products_services || []),
    ...(profile.industries || []),
    ...(profile.keywords || []),
    ...(profile.public_sector_search_terms || []),
    ...(profile.opportunity_lanes || [])
  ].join(" ").toLowerCase();
}

async function searchStateLocalPortals(profile) {
  if (!stateLocalRequested(profile)) return [];
  const profileText = stateLocalProfileText(profile);
  const terms = collectSearchTerms(profile, 10).filter((term) => term.length >= 4);
  if (!terms.length) return [];
  const selected = stateLocalPortals.filter((portal) => portal[5].test(profileText)).slice(0, 6);
  if (selected.length) {
    // Do not save portal search routes as opportunities. Only confirmed postings
    // with source evidence, timing, and buyer context should enter the report.
    return [];
  }
  const signals = [];
  const seen = new Set();
  for (const [id, name, geography, category, baseUrl, trigger, buyerRoles] of selected) {
    const term = terms.find((candidate) => trigger.test(candidate)) || terms[0];
    const sourceUrl = id === "seattle-opengov"
      ? `${baseUrl}?search=${encodeURIComponent(term)}`
      : id === "la-ramp"
        ? `https://www.rampla.org/s/search/?q=${encodeURIComponent(term)}`
        : id === "opengov-portal-network"
          ? `${baseUrl}?search=${encodeURIComponent(term)}`
          : baseUrl;
    const key = `${id}:${term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lane = inferSignalLane(`${name} ${term} ${category}`.toLowerCase(), "State/local procurement route");
    signals.push({
      opportunity_title: `${name}: search route for ${term}`,
      source_type: "procurement_category",
      source_name: "State/local portal routing",
      source_url: sourceUrl,
      agency_or_funder: name,
      deadline: "",
      geography,
      external_evidence_summary: `${name} is a state/local source route to check for "${term}" solicitations, vendor registration paths, and department-level program opportunities.`,
      why_it_matters: "Many local opportunities do not appear in federal databases. This route gives the scan a repeatable way to check city, state, school, tourism, parks, and arts procurement sources for current bids or vendor paths.",
      who_benefits: profile.company_name,
      likely_buyer_or_partner: name,
      revenue_pathway: "procurement_bid",
      relevance_score: clampScore(58 + (String(category).includes("arts") ? 8 : 0)),
      novelty_score: 62,
      confidence_score: 48,
      reasoning: [
        `Matched state/local source category: ${category}`,
        `Matched search term: ${term}`,
        `Inferred lane: ${lane}`,
        "Portal route only: human review is required before treating this as a confirmed active opportunity."
      ],
      recommended_action: `Open the portal route, search "${term}", and verify whether there is a current solicitation, vendor list, or program contact.`,
      actionability: "maybe",
      actionability_reason: "This is a targeted state/local portal route, not yet a confirmed open solicitation with a deadline.",
      best_next_step: `Check ${name} for current postings and contact one of these roles: ${buyerRoles.join(", ")}.`,
      human_review_required: true,
      query_used: term,
      raw_json: {
        portal_id: id,
        portal_category: category,
        portal_base_url: baseUrl,
        buyer_roles: buyerRoles,
        source_note: "State/local portal route. Do not present as a confirmed bid until a solicitation record is verified."
      }
    });
  }
  return signals;
}

async function discoverExternalSignals(profile) {
  const activeSources = profile.activated_source_categories || [];
  const searches = [];
  if (!activeSources.length || activeSources.includes("usaspending.gov")) searches.push(searchUsaSpending(profile));
  if (!activeSources.length || activeSources.includes("federal_register")) searches.push(searchFederalRegister(profile));
  if (activeSources.includes("grants.gov") || (profile.planned_source_categories || []).includes("grants.gov")) searches.push(searchGrantsGov(profile));
  if ((activeSources.includes("sam.gov") || (profile.planned_source_categories || []).includes("sam.gov")) && isSamGovConfigured()) searches.push(searchSamGov(profile));
  if (
    activeSources.includes("state_local") ||
    (profile.planned_source_categories || []).some((source) => /state|local|city|county|school_district|procurement|parks|tourism|arts_council|education_department|workforce_board/i.test(source))
  ) searches.push(searchStateLocalPortals(profile));
  const results = await Promise.allSettled(searches);
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function saveSignalsToDb(db, scanId, signals) {
  const now = new Date().toISOString();
  for (const signal of signals) {
    const opportunityId = randomUUID();
    db.source_results.push({
      id: randomUUID(),
      scan_id: scanId,
      source_name: signal.source_name,
      source_type: signal.source_type,
      query_used: signal.query_used,
      title: signal.opportunity_title,
      url: signal.source_url,
      raw_json: signal.raw_json,
      created_at: now
    });
    db.opportunities.push({
      id: opportunityId,
      source: signal.source_name,
      source_id: signal.source_url,
      title: signal.opportunity_title,
      url: signal.source_url,
      agency: signal.agency_or_funder,
      category: signal.source_type,
      deadline: signal.deadline,
      geography: signal.geography,
      raw_json: signal,
      created_at: now
    });
    db.scan_opportunities.push({
      id: randomUUID(),
      scan_id: scanId,
      opportunity_id: opportunityId,
      relevance_score: signal.relevance_score,
      novelty_score: signal.novelty_score,
      confidence_score: signal.confidence_score,
      reasoning_json: signal.reasoning,
      recommended_action: signal.recommended_action,
      human_review_required: signal.human_review_required,
      created_at: now
    });
  }
}

function inferOpportunityLanes(keywords, rawText, industry, input) {
  const haystack = `${keywords.join(" ")} ${industry || ""} ${input ? intentText(input) : ""} ${rawText.slice(0, 6000)}`.toLowerCase();
  const laneSearchTerms = {};

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

function generateProfile(input, rawText) {
  const keywords = pickTerms(rawText);
  const focusKeywords = pickTerms(input.opportunity_focus || "", 10);
  const includeKeywords = phraseTerms(input.include_terms || "");
  const keywordsWithIntent = unique([...includeKeywords, ...focusKeywords, ...keywords]);
  const publicTerms = inferPublicSectorTerms(keywordsWithIntent, input.industry, input);
  const lanes = inferOpportunityLanes(keywordsWithIntent, `${input.opportunity_focus || ""}\n${input.include_terms || ""}\n${rawText}`, input.industry, input);
  const host = new URL(input.company_url).hostname.replace(/^www\./, "");

  return applyPlaybooksToProfile({
    company_name: input.company_name || host.split(".")[0],
    website: input.company_url,
    summary: rawText.slice(0, 420) || "Initial profile generated from the submitted company website.",
    products_services: keywordsWithIntent.slice(0, 8),
    target_customers: input.customer_type ? [input.customer_type] : [],
    industries: input.industry ? [input.industry] : [],
    geographies: [input.headquarters_state, input.target_states].filter(Boolean),
    keywords: keywordsWithIntent,
    public_sector_search_terms: publicTerms,
    translated_public_sector_terms: publicTerms,
    negative_keywords: unique(["jobs", "careers", "press release", "investor relations", ...excludeTerms(input)]),
    possible_naics: inferCodes(keywords, input.industry, "naics"),
    possible_psc: [],
    possible_soc: inferCodes(keywords, input.industry, "soc"),
    policy_sensitive_categories: inferPolicyCategories(publicTerms),
    opportunity_lanes: lanes.opportunityLanes,
    lane_search_terms: lanes.laneSearchTerms,
    opportunity_categories: opportunityCategories,
    selected_playbooks: [],
    activated_source_categories: [],
    planned_source_categories: [],
    likely_revenue_motions: [],
    suggested_contact_roles: [],
    report_guidance: []
  }, input);
}

async function collectBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function send(res, html, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendCsv(res, csv, filename) {
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`
  });
  res.end(csv);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function renderHome(error) {
  return page(
    "Policy Opportunity Scanner",
    `<section class="top"><div class="wrap">
      <p class="eyebrow">Policy Opportunity Scanner</p>
      <h1>Find the policy, funding, and government-created opportunities hidden in your market.</h1>
      <p>Enter a company URL. Opportunity Scanner translates the business into public-sector language, checks external public data, and surfaces sourced opportunity signals.</p>
      <p><a href="/admin/reports">View completed scans</a> &nbsp; <a href="/admin/sources">View source coverage</a></p>
    </div></section>
    <main class="wrap grid">
      <form class="card" action="/api/scans" method="post">
        ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
        <label>Company website URL <input required name="companyUrl" type="url" placeholder="https://example.com"></label>
        <div class="row">
          <label>Company name <input name="companyName" placeholder="Optional"></label>
          <label>Industry <input name="industry" placeholder="Healthcare, education, SaaS..."></label>
        </div>
        <div class="row">
          <label>Headquarters state <input name="headquartersState" placeholder="MD"></label>
          <label>Target states / markets <input name="targetStates" placeholder="MD, CA, national"></label>
        </div>
        <div class="row">
          <label>Customer type
            <select name="customerType">
              <option value="">Optional</option><option>B2B</option><option>B2C</option><option>Government</option><option>Healthcare</option><option>Education</option><option>Nonprofit</option><option>Other</option>
            </select>
          </label>
          <label>Report type
            <select name="reportType"><option value="quick">Quick Scan</option><option value="deep">Deep Scan</option></select>
          </label>
        </div>
        <label>Email <input name="email" type="email" placeholder="Optional"></label>
        <label>What should this scan prioritize?
          <textarea name="opportunityFocus" rows="3" placeholder="Example: paid live music bookings for cities, parks, festivals, public events, and cultural programs" style="width:100%; border:1px solid #d8dee9; border-radius:6px; padding:10px; font:inherit"></textarea>
        </label>
        <div class="row">
          <label>Good-fit phrases
            <textarea name="includeTerms" rows="3" placeholder="Examples: summer concert series, teaching artists, tourism events" style="width:100%; border:1px solid #d8dee9; border-radius:6px; padding:10px; font:inherit"></textarea>
          </label>
          <label>Exclude phrases
            <textarea name="excludeTerms" rows="3" placeholder="Examples: behavioral health, construction, medical staffing" style="width:100%; border:1px solid #d8dee9; border-radius:6px; padding:10px; font:inherit"></textarea>
          </label>
        </div>
        <fieldset style="border:0; padding:0; margin:0; display:grid; gap:10px">
          <legend style="font-weight:700">Priority signal types</legend>
          <div class="row">
            ${priorityOptions.map(([value, label]) => `<label style="display:flex; align-items:center; gap:8px"><input type="checkbox" name="prioritySignals" value="${escapeHtml(value)}"> ${escapeHtml(label)}</label>`).join("")}
          </div>
        </fieldset>
        <button>Run free opportunity scan</button>
      </form>
      <aside class="card">
        <h2>What The Scan Produces</h2>
        <p>Builds a focused company profile from the website.</p>
        <p>Translates the business into public-sector search language and opportunity lanes.</p>
        <p>Checks available public sources for sourced funding, procurement, policy, and money-flow signals.</p>
      </aside>
    </main>`
  );
}

function renderReport(scan, profileRecord, signals = [], options = {}) {
  const profile = profileRecord?.profile_json;
  const chips = (items = []) => items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  const freeSignalLimit = 3;
  const opportunityHeadline = (signal) => {
    const match = String(signal.opportunity_title || "").match(/^(.+?) received (\$[^:]+): (.+)$/);
    if (match) {
      return `${match[3]}: ${match[1]} funded ${match[2]}`;
    }
    return signal.opportunity_title || "Untitled opportunity";
  };
  const signalLane = (signal) => {
    const laneReason = (signal.reasoning || []).find((item) => item.startsWith("Inferred lane:"));
    return laneReason?.replace("Inferred lane:", "").trim() || signal.revenue_pathway.replaceAll("_", " ");
  };
  const signalDate = (signal, field) => typeof signal.raw_json?.[field] === "string" ? signal.raw_json[field] : "";
  const assessActionability = (signal) => {
    const lane = signalLane(signal).toLowerCase();
    const endDate = signal.deadline || signalDate(signal, "End Date");
    const startDate = signalDate(signal, "Start Date");
    const currentDate = "2026-06-29";
    const recentStart = startDate >= "2024-01-01";
    const stillActive = Boolean(endDate && endDate >= currentDate);
    const expired = Boolean(endDate && endDate < currentDate);
    const infrastructureOnly = lane.includes("infrastructure") || signal.revenue_pathway === "monitor_policy";
    const directProcurementLane =
      lane.includes("medical and rehabilitation supply") ||
      lane.includes("medical retail") ||
      lane.includes("distributor") ||
      lane.includes("channel") ||
      lane.includes("prosthetics") ||
      lane.includes("orthotics") ||
      lane.includes("teacher staffing") ||
      lane.includes("educator workforce") ||
      lane.includes("education workforce") ||
      lane.includes("recruiting technology") ||
      lane.includes("funded-buyer") ||
      lane.includes("creative workforce") ||
      lane.includes("music-industry") ||
      lane.includes("entertainment procurement") ||
      lane.includes("live performance") ||
      lane.includes("public concerts") ||
      lane.includes("arts and culture") ||
      lane.includes("arts programming") ||
      lane.includes("public event production") ||
      lane.includes("tourism") ||
      lane.includes("placemaking") ||
      lane.includes("downtown") ||
      lane.includes("state arts council") ||
      lane.includes("library and community") ||
      lane.includes("cultural programming") ||
      lane.includes("live events") ||
      lane.includes("public arts");
    const bestNextStepForLane = () => {
      if (lane.includes("live performance") || lane.includes("public concerts") || lane.includes("arts") || lane.includes("creative") || lane.includes("tourism") || lane.includes("placemaking") || lane.includes("event production")) {
        return "Validate whether outreach should go to the funded organization, cultural affairs office, events team, school arts program, or procurement contact.";
      }
      if (lane.includes("teacher") || lane.includes("educator") || lane.includes("school") || lane.includes("recruiting") || lane.includes("workforce")) {
        return "Research the recipient and agency, then decide whether outreach should go to district HR, the funded program lead, procurement, or an implementation partner.";
      }
      if (lane.includes("medical") || lane.includes("rehab") || lane.includes("dme") || lane.includes("prosthetic") || lane.includes("orthotic") || lane.includes("distributor")) {
        return "Research the recipient and agency, then decide whether outreach should go to the distributor, procurement office, or clinical influencer.";
      }
      return "Research the recipient and agency, then decide whether outreach should go to the funded organization, procurement office, or implementation partner.";
    };
    const signalText = [signal.opportunity_title, signal.external_evidence_summary, signal.query_used, signal.agency_or_funder, signal.likely_buyer_or_partner].join(" ").toLowerCase();
    const isCreativeLane = lane.includes("live performance") || lane.includes("public concerts") || lane.includes("arts") || lane.includes("creative") || lane.includes("tourism") || lane.includes("placemaking") || lane.includes("event production") || lane.includes("event entertainment") || lane.includes("performer") || lane.includes("music") || /live music|music performance|musical performance|musician services|concert|event entertainment|performer services|artist booking|festival entertainment/.test(signalText);

    if (infrastructureOnly) {
      return {
        actionability: "unlikely",
        reason: "This is infrastructure or policy context, not a buyer/channel the company can reasonably pursue now.",
        bestNextStep: "Do not surface as a lead; use only for background market mapping."
      };
    }

    if (expired) {
      return {
        actionability: "unlikely",
        reason: "This record has already ended, so it should not be shown as an actionable opportunity.",
        bestNextStep: "Hide from the actionable report; use only for internal pattern research."
      };
    }

    if (directProcurementLane && signal.relevance_score >= 72 && signal.confidence_score >= 70 && stillActive) {
      return {
        actionability: "yes",
        reason: "Current or active spending in a directly adjacent buyer, channel, procurement, or funded-recipient pathway.",
        bestNextStep: bestNextStepForLane()
      };
    }

    if (directProcurementLane && signal.relevance_score >= 68 && signal.confidence_score >= 70 && recentStart) {
      return {
        actionability: "maybe",
        reason: "Recent adjacent spending suggests a possible pathway, but the buyer/channel fit needs validation.",
        bestNextStep: bestNextStepForLane()
      };
    }

    if (isCreativeLane && directProcurementLane && signal.relevance_score >= 64 && signal.confidence_score >= 70 && recentStart) {
      return {
        actionability: "maybe",
        reason: "Recent live-music, performance, event, or arts spending suggests a possible buyer or partner pathway, even if the award is smaller or more targeted.",
        bestNextStep: bestNextStepForLane()
      };
    }

    return {
      actionability: "unlikely",
      reason: "The signal is too indirect, old, or weakly matched to recommend as a move-forward opportunity.",
      bestNextStep: "Hide from the report unless a human analyst promotes it after review."
    };
  };
  const isMoveForwardSignal = (signal) => assessActionability(signal).actionability !== "unlikely";
  const routeLabel = (signal) => {
    if (signal.revenue_pathway === "sell_to_agency" || signal.revenue_pathway === "procurement_bid") {
      return "Agency/procurement route: identify the buying office, contract vehicle, or district/admin contact.";
    }
    if (signal.revenue_pathway === "sell_to_grantee" || signal.revenue_pathway === "partner_with_recipient") {
      return "Recipient/partner route: contact the funded organization or implementation partner, not the grant itself.";
    }
    if (signal.revenue_pathway === "direct_apply") {
      return "Direct-apply route: review eligibility and decide whether the company can apply itself.";
    }
    if (signal.revenue_pathway === "monitor_policy") {
      return "Policy/admin route: monitor the agency or program administrator until a contract, grant, or buyer appears.";
    }
    return "Channel route: use this as a market map signal, then validate the best buyer or partner.";
  };
  const signalTiming = (signal) => {
    const endDate = signal.deadline || signalDate(signal, "End Date");
    const startDate = signalDate(signal, "Start Date");
    if (endDate >= "2026-06-29") return `Active/current through ${endDate}`;
    if (endDate >= "2024-01-01") return `Recent prior evidence, ended ${endDate}`;
    if (startDate >= "2024-01-01") return `Recent start ${startDate}, timing needs review`;
    return endDate ? `Older evidence, ended ${endDate}` : "Timing needs review";
  };
  const sourceTypeLabel = (signal) => {
    const endDate = signal.deadline || signalDate(signal, "End Date");
    if (signal.source_type === "historical_award" && endDate >= "2026-06-29") return "current funded program";
    return String(signal.source_type || "").replaceAll("_", " ");
  };
  const contactRolesForSignal = (signal) => {
    const lane = signalLane(signal).toLowerCase();
    const evidence = [signal.opportunity_title, signal.external_evidence_summary, signal.query_used, signal.agency_or_funder, signal.likely_buyer_or_partner, lane].join(" ").toLowerCase();
    if (/tourism|parks|recreation|placemaking|public space|public plaza|open streets|downtown|bid|business improvement district|city of|county/.test(`${lane} ${evidence}`)) return ["Special Events Manager", "Cultural Affairs Manager", "Parks and Recreation Director", "Tourism or Downtown Partnership Director", "Procurement Specialist"];
    if (/symphony|performing arts|arts council|artist|musician|concert|live music|event entertainment|booking/.test(`${lane} ${evidence}`)) return ["Executive Director", "Programming Director", "Events or Production Manager", "Partnerships Director", "Grants Manager"];
    if (/school|district|education|teaching artist|arts education|enrichment/.test(`${lane} ${evidence}`)) return ["Arts Coordinator", "Enrichment Program Director", "CTE or Workforce Program Director", "Procurement Specialist"];
    if (/medical|rehab|dme|prosthetic|orthotic|clinical|health/.test(`${lane} ${evidence}`)) return ["Procurement Manager", "Clinical Program Director", "Rehab Services Director", "Partnerships Director", "Grants Manager"];
    if (/teacher|educator|workforce|recruiting|staffing/.test(`${lane} ${evidence}`)) return ["Workforce Program Manager", "HR Director", "Program Director", "Procurement Specialist", "Grants Manager"];
    return ["Program Director", "Procurement Specialist", "Partnerships Director", "Grants Manager"];
  };
  const outreachAngleForSignal = (signal) => {
    const lane = signalLane(signal).toLowerCase();
    const evidence = [signal.opportunity_title, signal.external_evidence_summary, signal.query_used, lane].join(" ").toLowerCase();
    if (/live music|concert|musician|performer|event entertainment|festival|public event|cultural programming/.test(`${lane} ${evidence}`)) return "Lead with a live-music or performer booking angle and ask who manages programming, vendor selection, or partner bookings.";
    if (/tourism|placemaking|downtown|public space|open streets|public plaza|bid|business improvement district/.test(`${lane} ${evidence}`)) return "Lead with public-space activation and position the company as a way to source reliable live programming for visitor, downtown, or community event goals.";
    if (/school|education|enrichment|teaching artist/.test(`${lane} ${evidence}`)) return "Lead with enrichment delivery and ask who manages arts programming, after-school enrichment, or vendor partnerships.";
    if (/medical|rehab|dme|prosthetic|orthotic/.test(`${lane} ${evidence}`)) return "Lead with the relevant product use case and ask who owns purchasing, clinical recommendations, or patient support programs.";
    return "Lead with the source record, explain the relevant fit in one sentence, and ask who owns vendor, partner, or program decisions.";
  };
  const primaryContactTarget = (signal) => {
    const sourceContactIsActionable = (signal.source_name === "SAM.gov" && (
      signal.source_type === "active_contract" ||
      signal.source_type === "procurement_category" ||
      signal.revenue_pathway === "procurement_bid" ||
      signal.revenue_pathway === "sell_to_agency"
    )) || (signal.source_name === "Grants.gov" && signal.revenue_pathway === "direct_apply");
    const sourceContacts = sourceContactIsActionable && Array.isArray(signal.raw_json?.pointOfContact) ? signal.raw_json.pointOfContact : [];
    const firstSourceContact = sourceContacts.find((item) => item && typeof item === "object" && (item.fullName || item.fullname || item.title || item.email || item.phone));
    if (firstSourceContact) {
      const organization = signal.likely_buyer_or_partner || signal.agency_or_funder || "Source-listed organization";
      const name = firstSourceContact.fullName || firstSourceContact.fullname || "";
      const title = firstSourceContact.title || firstSourceContact.type || "Source-listed point of contact";
      const email = firstSourceContact.email || "";
      const phone = firstSourceContact.phone || "";
      return {
        organization,
        roles: [title],
        name,
        title,
        email,
        phone,
        outreachAngle: outreachAngleForSignal(signal),
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent([organization, name || title, email ? "" : "email contact"].filter(Boolean).join(" "))}`
      };
    }
    const organization = signal.likely_buyer_or_partner || signal.agency_or_funder || "Buyer or funded organization";
    const roles = contactRolesForSignal(signal);
    return {
      organization,
      roles,
      outreachAngle: outreachAngleForSignal(signal),
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent([organization, roles.slice(0, 3).join(" OR "), "email contact"].filter(Boolean).join(" "))}`
    };
  };
  const contactDiscoverySummary = (signal) => {
    const targets = [primaryContactTarget(signal)];
    const verifiedContacts = targets.filter((target) => target.name || target.email || target.phone).length;
    const targetRoles = [...new Set(targets.flatMap((target) => target.roles || []))].length;
    return verifiedContacts > 0
      ? {
          statusLabel: `${verifiedContacts} verified contact${verifiedContacts === 1 ? "" : "s"}`,
          detailLabel: `${targetRoles} relevant role${targetRoles === 1 ? "" : "s"} mapped`
        }
      : {
          statusLabel: "0 verified contacts",
          detailLabel: `${targetRoles} target role${targetRoles === 1 ? "" : "s"} identified`
        };
  };
  const renderFeedbackForm = (signal) => `<details style="margin-top:14px; border:1px solid #d8dee9; border-radius:6px; background:#f5f7fb; padding:12px">
      <summary style="cursor:pointer; font-weight:700">Improve future scans</summary>
      <form action="/api/feedback" method="post" style="margin-top:12px; display:grid; gap:10px">
        <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
        <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
        <textarea name="reason" rows="2" placeholder="Optional: tell us why this is useful or off-target" style="width:100%; border:1px solid #d8dee9; border-radius:6px; padding:10px; font:inherit"></textarea>
        <div style="display:flex; flex-wrap:wrap; gap:8px">
          <button name="feedbackKind" value="more_like_this" style="background:#059669">More like this</button>
          <button name="feedbackKind" value="less_like_this" style="background:#334155">Less like this</button>
        </div>
      </form>
    </details>`;
  const contactSearchUrl = (signal) => primaryContactTarget(signal).searchUrl;
  const directRevenueFitScore = (signal) => {
    const lane = signalLane(signal).toLowerCase();
    const evidence = [
      signal.opportunity_title,
      signal.external_evidence_summary,
      signal.why_it_matters,
      signal.query_used,
      signal.agency_or_funder,
      signal.likely_buyer_or_partner,
      lane
    ].join(" ").toLowerCase();
    const endDate = signal.deadline || signalDate(signal, "End Date");
    let score = signal.relevance_score + signal.confidence_score + signal.novelty_score;
    if (endDate >= "2026-06-29") score += 45;
    else if (endDate >= "2025-01-01") score += 18;
    else if (endDate) score -= 35;
    if (/live music|music performance|musical performance|musician services|performer services|performing artist|artist booking|event entertainment|festival entertainment|concert|summer concert|public concerts|public event production|event production services/.test(evidence)) score += 80;
    if (/city of|county|department of parks|parks recreation|tourism|downtown|business improvement district|bid programming|partnership|alliance|conservancy|greenway|public plaza|public space|open streets|night market|neighborhood festival|public venue|cultural affairs|arts commission|school district|university|academy|military band/.test(evidence)) score += 36;
    if (/event entertainment|musician services|live music|public concerts|summer concert|public event production|public space activation|downtown activation|district event programming/.test(evidence)) score += 25;
    if (lane.includes("school and district arts programming") || lane.includes("creative workforce") || lane.includes("arts and culture grants")) score -= 18;
    if (/visual arts|museum visit|graphic artist|workforce development|former incarcerated|case management|exhibition only/.test(evidence)) score -= 45;
    if (signal.source_type === "policy_signal") score -= 80;
    if (signal.revenue_pathway === "monitor_policy") score -= 60;
    return score;
  };
  const sortByDirectRevenueFit = (items) => [...items].sort((a, b) => directRevenueFitScore(b) - directRevenueFitScore(a));
  const isDirectRevenueReadySignal = (signal) => directRevenueFitScore(signal) >= 330;
  const normalizedOpportunityDate = (value) => {
    const text = String(value || "");
    const grantMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (grantMatch) return `${grantMatch[3]}-${grantMatch[1].padStart(2, "0")}-${grantMatch[2].padStart(2, "0")}`;
    const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return isoMatch ? isoMatch[1] : text;
  };
  const revenueAssessment = (signal) => {
    const lane = signalLane(signal);
    const evidence = [
      signal.opportunity_title,
      signal.external_evidence_summary,
      signal.why_it_matters,
      signal.query_used,
      signal.agency_or_funder,
      signal.likely_buyer_or_partner,
      lane
    ].join(" ").toLowerCase();
    const endDate = signal.deadline || signalDate(signal, "End Date");
    const normalizedEndDate = normalizedOpportunityDate(endDate);
    const buyer = signal.likely_buyer_or_partner || signal.agency_or_funder || "";
    const roles = contactRolesForSignal(signal).slice(0, 3).join(", ");

    if (signal.source_name === "State/local portal routing") {
      return { show: false, fit: "No", path: "Route only", reason: "This is only a portal route, not a verified opportunity.", nextStep: "Do not show in the paid report until a specific posting is verified." };
    }
    if (signal.source_type === "policy_signal" || signal.revenue_pathway === "monitor_policy") {
      return { show: false, fit: "No", path: "Policy context", reason: "Policy context is not a revenue opportunity by itself.", nextStep: "Only use as background if paired with a buyer or posting." };
    }
    if (endDate) {
      if (normalizedEndDate < "2026-06-30") {
        return { show: false, fit: "No", path: "Expired", reason: `The opportunity ended or closed on ${endDate}.`, nextStep: "Do not show as a revenue opportunity." };
      }
    }
    if (/domestic awardees|miscellaneous foreign awardees|undisclosed/.test(evidence)) {
      return { show: false, fit: "No", path: "No reachable buyer", reason: "The recipient is undisclosed or not reachable enough for sales outreach.", nextStep: "Exclude from the opportunity table." };
    }

    const liveMusicFit = /live music|music performance|musical performance|musician services|performer services|performing artist|artist booking|event entertainment|festival entertainment|concert|summer concert|public concerts|public event production|event production services|tourism|placemaking|parks recreation/.test(evidence);
    const clearBuyerFit = /city of|county|department of parks|parks recreation|tourism|downtown|business improvement district|public plaza|public space|open streets|night market|neighborhood festival|public venue|cultural affairs|arts commission|symphony|booking|events/i.test(evidence);
    const tooIndirect = /creative workforce|arts workforce|school and district arts programming|arts education|music education|legal services|heritage center|creative tech exchange|talent program|grants for arts projects/.test(evidence);

    if (signal.source_type === "active_grant") {
      const directGrant = signal.revenue_pathway === "direct_apply" && liveMusicFit && !tooIndirect;
      if (!directGrant) {
        return { show: false, fit: "Maybe later", path: "Funding context", reason: "This grant may be useful context, but the immediate sales path is not clear enough for a paid opportunity table.", nextStep: "Track separately as funding intelligence, not as a revenue lead." };
      }
    }

    if (!liveMusicFit || tooIndirect) {
      return { show: false, fit: "No", path: "Weak revenue fit", reason: "The record is current or adjacent, but it does not clearly point to paid live music/event delivery.", nextStep: "Exclude unless user feedback marks this pattern as valuable." };
    }

    if (!clearBuyerFit && signal.source_type === "historical_award") {
      return { show: false, fit: "Maybe later", path: "Pattern only", reason: "This looks like adjacent spending, but the buyer path is not obvious enough.", nextStep: "Use as market evidence, not a main opportunity." };
    }

    const path = signal.revenue_pathway === "procurement_bid" || signal.revenue_pathway === "sell_to_agency"
      ? "Sell/bid to agency"
      : signal.revenue_pathway === "direct_apply"
        ? "Apply or partner"
        : "Sell to funded buyer";
    const nextStep = `Find the ${roles || "program or procurement owner"} at ${buyer || "the buyer/recipient"} and lead with live music/event programming fit tied to this source record.`;
    return {
      show: isMoveForwardSignal(signal) || signal.source_type === "active_grant",
      fit: clearBuyerFit ? "Strong" : "Medium",
      path,
      reason: clearBuyerFit
        ? "Current source evidence connects to live music, events, tourism, parks, public programming, or a funded buyer with a plausible outreach path."
        : "Current source evidence is relevant, but buyer ownership still needs validation.",
      nextStep
    };
  };
  const isCurrentRealOpportunity = (signal) => revenueAssessment(signal).show;
  const isRelevantPriorExample = (signal) => {
    return false;
  };
  const isRelevantPriorExampleDisabled = (signal) => {
    const lane = signalLane(signal).toLowerCase();
    const text = [
      signal.opportunity_title,
      signal.external_evidence_summary,
      signal.why_it_matters,
      signal.query_used,
      signal.agency_or_funder
    ].join(" ").toLowerCase();
    const endDate = signal.deadline || signalDate(signal, "End Date");
    const directCategory =
      lane.includes("medical and rehabilitation supply") ||
      lane.includes("prosthetics") ||
      lane.includes("orthotics") ||
      lane.includes("live performance") ||
      lane.includes("public concerts") ||
      lane.includes("arts and culture") ||
      lane.includes("arts programming") ||
      lane.includes("creative workforce") ||
      lane.includes("public event production") ||
      lane.includes("tourism") ||
      lane.includes("placemaking") ||
      lane.includes("state arts council") ||
      lane.includes("teacher staffing") ||
      lane.includes("educator workforce") ||
      lane.includes("education workforce") ||
      lane.includes("recruiting technology") ||
      text.includes("prosthetic") ||
      text.includes("orthotic") ||
      text.includes("rehabilitation supplies") ||
      text.includes("physical therapy supplies") ||
      text.includes("live music") ||
      text.includes("public concerts") ||
      text.includes("teaching artists") ||
      text.includes("arts education") ||
      text.includes("event entertainment") ||
      text.includes("teacher recruitment") ||
      text.includes("educator workforce") ||
      text.includes("applicant tracking");
    const indirectOrInfrastructure =
      lane.includes("infrastructure") ||
      signal.revenue_pathway === "monitor_policy" ||
      text.includes("software") ||
      text.includes("information technology") ||
      text.includes("case management") ||
      text.includes("public health infrastructure");

    return (
      !isMoveForwardSignal(signal) &&
      signal.source_type === "historical_award" &&
      directCategory &&
      !indirectOrInfrastructure &&
      Boolean(endDate) &&
      endDate >= "2022-01-01" &&
      endDate < "2026-06-29"
    );
  };
  const isCreativeReport = Boolean(profile?.selected_playbooks?.some((playbook) => playbook.playbook_id === "music_arts_creative_economy"));
  const paidRealSignals = sortByDirectRevenueFit(signals.filter(isCurrentRealOpportunity));
  const isAdminView = options.access === "admin";
  const isUnlocked = isAdminView || scan.report_access === "unlocked" || scan.report_access === "admin";
  const moveForwardSignals = isCreativeReport
    ? paidRealSignals.filter(isDirectRevenueReadySignal)
    : signals.filter(isMoveForwardSignal);
  const tableSignalPool = isUnlocked && isCreativeReport ? paidRealSignals : moveForwardSignals;
  const priorExampleSignals = signals.filter(isRelevantPriorExample).slice(0, 4);
  const fullDisplayedSignals = tableSignalPool.slice(0, isCreativeReport ? 30 : 10);
  const displayedSignals = isUnlocked ? fullDisplayedSignals : fullDisplayedSignals.slice(0, freeSignalLimit);
  const lockedCount = Math.max(0, fullDisplayedSignals.length - displayedSignals.length);
  const sortedSignals = isCreativeReport
    ? sortByDirectRevenueFit(moveForwardSignals.length ? moveForwardSignals : signals)
    : [...(moveForwardSignals.length ? moveForwardSignals : signals)].sort((a, b) => b.relevance_score + b.confidence_score + b.novelty_score - (a.relevance_score + a.confidence_score + a.novelty_score));
  const bestSignal = sortedSignals[0];
  const buyers = [...new Set(sortedSignals.map((signal) => signal.likely_buyer_or_partner || signal.agency_or_funder).filter(Boolean))].slice(0, 4);
  const topQueryTerms = () => {
    const counts = new Map();
    for (const signal of signals) {
      if (!signal.query_used) continue;
      counts.set(signal.query_used, (counts.get(signal.query_used) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term, count]) => `${term} (${count})`);
  };
  const sourceCounts = signals.reduce((counts, signal) => {
    counts[signal.source_name] = (counts[signal.source_name] || 0) + 1;
    return counts;
  }, {});
  const stateLocalRoutes = signals
    .filter((signal) => signal.source_name === "State/local portal routing")
    .slice(0, 8);
  const renderSearchStrategy = () => `<section class="card" style="margin-top:18px">
      <div class="split"><div><h2>Search Strategy</h2><p>This is the opportunity-search layer: playbook, lanes, phrases, source routing, and user intent that shaped this scan.</p></div><div class="status">Strategy v1</div></div>
      <div class="grid" style="margin-top:14px">
        <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Selected playbook</h2><div class="chips">${chips((profile?.selected_playbooks || scan.selected_playbooks || []).map((playbook) => playbook.name)).trim() || "<p>General public-sector opportunity scan</p>"}</div></div>
        <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>User intent</h2><p>${escapeHtml(scan.opportunity_focus || "Inferred from the company website and selected fields.")}</p>${scan.priority_signals?.length ? `<div class="chips">${chips(scan.priority_signals.map((signal) => signal.replaceAll("_", " ")))}</div>` : ""}</div>
        <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Good-fit phrases</h2><p>${escapeHtml(scan.include_terms || "No explicit include phrases provided.")}</p></div>
        <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Excluded phrases</h2><p>${escapeHtml(scan.exclude_terms || "No explicit exclude phrases provided.")}</p></div>
        <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Search lanes</h2><div class="chips">${chips((profile?.opportunity_lanes || []).slice(0, 8))}</div></div>
        <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Best-performing terms</h2><div class="chips">${chips(topQueryTerms()) || "<p>No external signal terms returned yet.</p>"}</div></div>
      </div>
    </section>`;
  const renderSourceCoverage = () => {
    const activeRows = [
      ["Company website", "Checked", "Profile generated"],
      ["USAspending.gov", profile?.activated_source_categories?.includes("usaspending.gov") ? "Checked" : "Available", `${sourceCounts["USAspending.gov"] || 0} signal(s)`],
      ["Federal Register", profile?.activated_source_categories?.includes("federal_register") ? "Checked" : "Available", `${sourceCounts["Federal Register"] || 0} signal(s)`],
      ["Grants.gov", "Checked", `${sourceCounts["Grants.gov"] || 0} signal(s)`],
      ["SAM.gov", isSamGovConfigured() ? (samGovLastError ? "Limited" : "Checked") : "Needs API key", isSamGovConfigured() ? (samGovLastError || `${sourceCounts["SAM.gov"] || 0} signal(s)`) : "Add SAM_API_KEY to query active opportunities"],
      ["State/local portals", "Checked", "0 confirmed postings surfaced"]
    ];
    return `<section class="card" style="margin-top:18px"><h2>Sources Checked</h2><p>The report separates sources already queried from planned connectors so the coverage is transparent.</p>
      <div style="overflow-x:auto; margin-top:14px"><table style="width:100%; min-width:720px; border-collapse:collapse; font-size:13px">
        <thead><tr style="background:#f5f7fb; color:#64748b; text-transform:uppercase; letter-spacing:.04em"><th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Source</th><th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Status</th><th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Result</th></tr></thead>
        <tbody>${activeRows.map(([source, status, result]) => `<tr><td style="padding:10px; border-bottom:1px solid #d8dee9"><strong>${escapeHtml(source)}</strong></td><td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(status)}</td><td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(result)}</td></tr>`).join("")}</tbody>
      </table></div>
    </section>`;
  };
  const renderStateLocalRoutes = () => stateLocalRoutes.length ? `<section class="card" style="margin-top:18px">
      <div class="split">
        <div>
          <h2>State/Local Routes To Check Next</h2>
          <p>These are targeted city, state, arts, tourism, parks, and procurement portals. They are not shown as confirmed bids until a posting/deadline is verified.</p>
        </div>
        <div class="status">${stateLocalRoutes.length} route(s)</div>
      </div>
      <div class="grid" style="margin-top:14px">
        ${stateLocalRoutes.map((signal) => {
          const roles = Array.isArray(signal.raw_json?.buyer_roles) ? signal.raw_json.buyer_roles : contactRolesForSignal(signal);
          return `<article class="card" style="box-shadow:none; background:#f5f7fb">
            <h2><a href="${escapeHtml(signal.source_url)}" target="_blank">${escapeHtml(signal.agency_or_funder || signal.opportunity_title)}</a></h2>
            <p>${escapeHtml(signal.geography || "State/local")}</p>
            <p><strong>Search:</strong> ${escapeHtml(signal.query_used || "live music services")}</p>
            <p><strong>Look for:</strong> current solicitations, vendor registration, events/cultural programming contacts, and procurement calendars.</p>
            <div class="chips">${chips(roles.slice(0, 4))}</div>
          </article>`;
        }).join("")}
      </div>
    </section>` : "";
  const renderCleanSignalTable = (tableSignals) => `<section class="card" style="margin-top:18px">
      <div class="split">
        <div>
          <h2>Opportunity Table</h2>
          <p>Current move-forward signals only. Use this like a working lead list: qualify, enrich contacts, export, or hide.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap"><div class="status">${tableSignals.length} opportunity${tableSignals.length === 1 ? "" : "ies"}</div>${isUnlocked ? `<a class="button" href="/api/reports/${escapeHtml(scan.id)}/export">Export CSV</a>` : `<div class="status">Export locked</div>`}</div>
      </div>
      <div style="overflow-x:auto; margin-top:14px">
        <table style="width:100%; min-width:1180px; border-collapse:collapse; font-size:13px">
          <thead>
            <tr style="background:#f5f7fb; color:#64748b; text-transform:uppercase; letter-spacing:.04em">
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Opportunity</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Buyer / Partner</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Why It Fits</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Timing</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Who To Find</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Next Step</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableSignals.map((signal) => {
              const actionability = assessActionability(signal);
              const contactTarget = primaryContactTarget(signal);
              return `<tr style="vertical-align:top">
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:240px">
                  <a href="/opportunities/${escapeHtml(signal.id || "")}?scanId=${escapeHtml(scan.id)}"><strong>${escapeHtml(opportunityHeadline(signal))}</strong></a>
                  <br><span style="color:#64748b; font-size:12px">${escapeHtml(signal.source_name)} · ${escapeHtml(sourceTypeLabel(signal))} · ${escapeHtml(signal.query_used || "search term")}</span>
                </td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:190px">${escapeHtml(signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review")}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:260px">
                  ${(() => { const assessment = revenueAssessment(signal); return `<span class="chip">${escapeHtml(assessment.fit)}</span><p style="margin:8px 0 0"><strong>${escapeHtml(assessment.path)}:</strong> ${escapeHtml(assessment.reason)}</p>`; })()}
                </td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:140px">${escapeHtml(signalTiming(signal))}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:210px">
                  <strong>${escapeHtml(contactTarget.organization)}</strong>
                  <br><span style="color:#64748b; font-size:12px">${escapeHtml(contactTarget.roles.slice(0, 3).join(", "))}</span>
                </td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:260px">${escapeHtml(revenueAssessment(signal).nextStep)}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; min-width:210px">
                  <div style="display:flex; flex-wrap:wrap; gap:6px">
                    <a href="/opportunities/${escapeHtml(signal.id || "")}?scanId=${escapeHtml(scan.id)}" style="display:inline-block; border:1px solid #d8dee9; border-radius:6px; padding:7px 9px; color:#334155; font-weight:750">Open</a>
                    <form action="/api/opportunities/enrich" method="post" style="display:inline">
                      <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
                      <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
                      <input type="hidden" name="enrichmentType" value="find_contacts">
                      <button style="padding:7px 9px; background:#172033">Enrich contacts</button>
                    </form>
                    <form action="/api/feedback" method="post" style="display:inline">
                      <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
                      <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
                      <input type="hidden" name="feedbackKind" value="more_like_this">
                      <input type="hidden" name="reason" value="Marked good fit from clean table">
                      <button style="padding:7px 9px; background:#059669">Good</button>
                    </form>
                    <form action="/api/opportunities/hide" method="post" style="display:inline">
                      <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
                      <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
                      <button style="padding:7px 9px; background:white; color:#334155; border:1px solid #d8dee9">Hide</button>
                    </form>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>`;
  const renderResearchDetails = () => `<details style="margin-top:18px">
      <summary class="card" style="cursor:pointer; font-weight:750">Research Details / Source Coverage</summary>
      <section class="card" style="margin-top:18px">
        <h2>Screened Source Matches</h2>
        <p>The scan found ${signals.length} sourced match${signals.length === 1 ? "" : "es"}. ${tableSignalPool.length} passed the revenue-readiness screen and ${Math.max(0, signals.length - tableSignalPool.length)} were filtered out before the opportunity table.</p>
        <div class="grid" style="margin-top:14px">
          ${(() => {
            const screened = signals
              .filter((signal) => !tableSignalPool.some((shown) => shown.id === signal.id))
              .map((signal) => revenueAssessment(signal));
            const counts = screened.reduce((acc, assessment) => {
              const key = assessment.path || "Filtered";
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {});
            return Object.entries(counts).length
              ? Object.entries(counts).map(([reason, count]) => `<div class="card" style="box-shadow:none; background:#f5f7fb"><h2>${escapeHtml(count)} filtered</h2><p>${escapeHtml(reason)}</p></div>`).join("")
              : `<div class="card" style="box-shadow:none; background:#f5f7fb"><h2>No filtered matches</h2><p>Every sourced match passed the revenue-readiness screen.</p></div>`;
          })()}
        </div>
      </section>
      ${renderSearchStrategy()}
      ${renderSourceCoverage()}
      ${isAdminView ? `<section class="card" style="margin-top:18px"><h2>Admin Research Notes</h2><div class="grid">
        <p><strong>Company understanding:</strong> does the summary describe what the company actually sells?</p>
        <p><strong>Translation:</strong> do the public-sector search terms sound like useful grant, procurement, funding, or policy language?</p>
        <p><strong>Next source step:</strong> verify high-value state/local routes and add domain resolution for contact enrichment.</p>
      </div></section>
      <section class="card" style="margin-top:18px"><h2>Company Profile Used For Search</h2><p>${escapeHtml(profile.summary)}</p><p>Source pages scraped: ${profileRecord.scraped_pages.length}</p></section>
      <section class="grid" style="margin-top:18px">
        <div class="card"><h2>Products / Services</h2><div class="chips">${chips(profile.products_services)}</div></div>
        <div class="card"><h2>Target Customers</h2><div class="chips">${chips(profile.target_customers)}</div></div>
        <div class="card"><h2>Keywords</h2><div class="chips">${chips(profile.keywords)}</div></div>
        <div class="card"><h2>Public-Sector Search Terms</h2><div class="chips">${chips(profile.public_sector_search_terms)}</div></div>
      </section>
      <details style="margin-top:18px"><summary class="card" style="cursor:pointer; font-weight:750">Raw Profile JSON</summary><section class="card" style="margin-top:8px"><pre>${escapeHtml(JSON.stringify(profile, null, 2))}</pre></section></details>` : ""}
    </details>`;
  const renderLockedPreview = () => lockedCount > 0 ? `<section class="card" style="margin-top:18px; border-color:#9bd3dd">
      <div class="split"><div><h2>Full Opportunity Scan Locked</h2><p>${lockedCount} additional sourced opportunity signal(s), full table export, deeper research context, and enrichment workflow are included in the full scan.</p></div><a class="button" href="?unlock=placeholder">Unlock Full Opportunity Scan - $99</a></div>
      <div class="grid" style="margin-top:14px"><div class="card" style="box-shadow:none; background:#f5f7fb">More sourced signals</div><div class="card" style="box-shadow:none; background:#f5f7fb">CSV/PDF export</div><div class="card" style="box-shadow:none; background:#f5f7fb">Contact and similar-opportunity enrichment</div></div>
    </section>` : "";
  const groupedSignals = displayedSignals.reduce((groups, signal) => {
    const lane = signalLane(signal);
    groups[lane] = [...(groups[lane] || []), signal];
    return groups;
  }, {});
  const renderSignalTable = (tableSignals) => `<section class="card" style="margin-top:18px">
      <div class="split">
        <div>
          <h2>Opportunity Signals Table</h2>
          <p>Qualify, hide, export, and start contact discovery from the strongest signals.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap"><div class="status">${tableSignals.length} shown</div>${isUnlocked ? `<a class="button" href="/api/reports/${escapeHtml(scan.id)}/export">Export CSV</a>` : `<div class="status">Export locked</div>`}</div>
      </div>
      <div style="overflow-x:auto; margin-top:14px">
        <table style="width:100%; min-width:1760px; border-collapse:collapse; font-size:13px">
          <thead>
            <tr style="background:#f5f7fb; color:#64748b; text-transform:uppercase; letter-spacing:.04em">
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Signal</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Lane</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Source</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Timing</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Buyer / Partner</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Contact Discovery</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Action</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Scores</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Query</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Next Step</th>
              <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableSignals.map((signal) => {
              const actionability = assessActionability(signal);
              const actionLabel = actionability.actionability === "yes" ? "Yes" : "Maybe";
              const contactTarget = primaryContactTarget(signal);
              const contactSummary = contactDiscoverySummary(signal);
              return `<tr style="vertical-align:top">
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:260px"><a href="/opportunities/${escapeHtml(signal.id || "")}?scanId=${escapeHtml(scan.id)}">${escapeHtml(opportunityHeadline(signal))}</a><br><span style="color:#64748b; font-size:12px">Open profile</span></td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:180px">${escapeHtml(signalLane(signal))}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(signal.source_name)}<br><span style="color:#64748b">${escapeHtml(sourceTypeLabel(signal))}</span></td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:170px">${escapeHtml(signalTiming(signal))}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:170px">${escapeHtml(signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review")}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:260px"><div style="background:#f5f7fb; border-radius:6px; padding:6px 8px; font-weight:750">${escapeHtml(contactSummary.statusLabel)}</div><div style="color:#64748b; font-size:12px; margin-top:4px">${escapeHtml(contactSummary.detailLabel)}</div><strong>${escapeHtml(contactTarget.organization)}</strong>${contactTarget.name ? `<br><span style="font-weight:650">${escapeHtml(contactTarget.name)}</span>` : ""}<br><span style="color:#64748b; font-size:12px">${escapeHtml(contactTarget.roles.slice(0, 3).join(", "))}</span>${contactTarget.email ? `<br><a href="mailto:${escapeHtml(contactTarget.email)}" style="font-size:12px">${escapeHtml(contactTarget.email)}</a>` : ""}${contactTarget.phone ? `<br><span style="color:#64748b; font-size:12px">${escapeHtml(contactTarget.phone)}</span>` : ""}<br><a href="${escapeHtml(contactTarget.searchUrl)}" target="_blank" style="display:inline-block; margin-top:6px; border:1px solid #d8dee9; border-radius:6px; padding:6px 8px; color:#334155; font-weight:750">Search contacts</a><form action="/api/opportunities/enrich" method="post" style="margin-top:6px"><input type="hidden" name="scanId" value="${escapeHtml(scan.id)}"><input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}"><input type="hidden" name="enrichmentType" value="find_contacts"><button style="padding:7px 9px; background:#172033">Enrich contacts</button></form></td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9"><span class="chip">${escapeHtml(actionLabel)}</span></td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; white-space:nowrap">R ${escapeHtml(signal.relevance_score)} / N ${escapeHtml(signal.novelty_score)} / C ${escapeHtml(signal.confidence_score)}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:140px">${escapeHtml(signal.query_used)}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:260px">${escapeHtml(actionability.bestNextStep)}</td>
                <td style="padding:10px; border-bottom:1px solid #d8dee9; min-width:220px">
                  <div style="display:flex; flex-wrap:wrap; gap:6px">
                    <form action="/api/feedback" method="post" style="display:inline">
                      <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
                      <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
                      <input type="hidden" name="feedbackKind" value="more_like_this">
                      <input type="hidden" name="reason" value="Marked good fit from table">
                      <button style="padding:7px 9px; background:#059669">Good</button>
                    </form>
                    <form action="/api/feedback" method="post" style="display:inline">
                      <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
                      <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
                      <input type="hidden" name="feedbackKind" value="less_like_this">
                      <input type="hidden" name="reason" value="Marked bad fit from table">
                      <button style="padding:7px 9px; background:#334155">Bad</button>
                    </form>
                    <form action="/api/opportunities/hide" method="post" style="display:inline">
                      <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
                      <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
                      <button style="padding:7px 9px; background:white; color:#334155; border:1px solid #d8dee9">Hide</button>
                    </form>
                    <a href="${escapeHtml(contactSearchUrl(signal))}" target="_blank" style="display:inline-block; border:1px solid #d8dee9; border-radius:6px; padding:7px 9px; color:#334155; font-weight:750">Find contacts</a>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>`;
  const renderSignalCard = (signal) =>
    { const actionability = assessActionability(signal);
      const startDate = typeof signal.raw_json?.["Start Date"] === "string" ? signal.raw_json["Start Date"] : "";
      const endDate = signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");
      const timingStatus = signalTiming(signal);
      return `<article class="card">
      <div style="background:${actionability.actionability === "yes" ? "#ecfdf5" : "#eff6ff"}; color:${actionability.actionability === "yes" ? "#166534" : "#1d4ed8"}; border:1px solid ${actionability.actionability === "yes" ? "#bbf7d0" : "#bfdbfe"}; border-radius:6px; padding:12px; margin-bottom:14px">
        <strong>Can this company move this forward? ${escapeHtml(actionability.actionability === "yes" ? "Yes" : "Maybe")}</strong>
        <p style="margin:6px 0 0; color:inherit">${escapeHtml(actionability.reason)}</p>
      </div>
      <div class="chips"><span class="chip">${escapeHtml(signal.source_name)}</span><span class="chip">${escapeHtml(sourceTypeLabel(signal))}</span></div>
      <h2><a href="${escapeHtml(signal.source_url)}" target="_blank">${escapeHtml(opportunityHeadline(signal))}</a></h2>
      <p>${escapeHtml(signal.external_evidence_summary)}</p>
      <p style="border:1px solid #d8dee9; border-radius:6px; padding:8px"><strong>Award timing:</strong> ${escapeHtml(timingStatus)}${startDate ? ` | Start: ${escapeHtml(startDate)}` : ""}</p>
      <p><strong>Why it matters:</strong> ${escapeHtml(signal.why_it_matters)}</p>
      <p><strong>Likely buyer/partner:</strong> ${escapeHtml(signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review")}</p>
      <p><strong>Recommended action:</strong> ${escapeHtml(signal.recommended_action)}</p>
      <p><strong>Primary route:</strong> ${escapeHtml(routeLabel(signal))}</p>
      <p><strong>Best next step:</strong> ${escapeHtml(actionability.bestNextStep)}</p>
      ${(() => { const contactTarget = primaryContactTarget(signal); return `<div style="border:1px solid #d8dee9; border-radius:6px; padding:10px; margin:12px 0"><p><strong>Who to contact first:</strong> ${escapeHtml(contactTarget.organization)}</p><p>${escapeHtml(contactTarget.roles.join(", "))}</p><p><strong>Outreach angle:</strong> ${escapeHtml(contactTarget.outreachAngle)}</p><p><a class="button" href="${escapeHtml(contactTarget.searchUrl)}" target="_blank">Find named contacts</a></p></div>`; })()}
      <div class="chips">
        <span class="chip">Relevance ${escapeHtml(signal.relevance_score)}</span>
        <span class="chip">Novelty ${escapeHtml(signal.novelty_score)}</span>
        <span class="chip">Confidence ${escapeHtml(signal.confidence_score)}</span>
        <span class="chip">Query: ${escapeHtml(signal.query_used)}</span>
      </div>
      ${renderFeedbackForm(signal)}
    </article>`; };
  const renderPriorExampleCard = (signal) => {
    const startDate = typeof signal.raw_json?.["Start Date"] === "string" ? signal.raw_json["Start Date"] : "";
    const endDate = signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");
    return `<article class="card">
      <div style="background:#fffbeb; color:#78350f; border:1px solid #fde68a; border-radius:6px; padding:12px; margin-bottom:14px">
        <strong>Prior buying-pattern evidence, not a live lead</strong>
        <p style="margin:6px 0 0; color:inherit">This is included because it shows adjacent public spending in a relevant category. Treat it as market evidence to guide targeting, not as an award the company can act on today.</p>
      </div>
      <div class="chips"><span class="chip">${escapeHtml(signal.source_name)}</span><span class="chip">${escapeHtml(sourceTypeLabel(signal))}</span></div>
      <h2><a href="${escapeHtml(signal.source_url)}" target="_blank">${escapeHtml(opportunityHeadline(signal))}</a></h2>
      <p>${escapeHtml(signal.external_evidence_summary)}</p>
      <p style="border:1px solid #d8dee9; border-radius:6px; padding:8px"><strong>Award timing:</strong> ${escapeHtml(endDate ? `Ended ${endDate}` : "Timing needs review")}${startDate ? ` | Start: ${escapeHtml(startDate)}` : ""}</p>
      <p><strong>Why it matters:</strong> ${escapeHtml(signal.why_it_matters)}</p>
      <p><strong>Likely buyer/partner:</strong> ${escapeHtml(signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review")}</p>
      <p><strong>Use it for:</strong> validating the buying channel and finding similar active buyers, funded recipients, partners, distributors, or contracts.</p>
      <div class="chips">
        <span class="chip">Relevance ${escapeHtml(signal.relevance_score)}</span>
        <span class="chip">Novelty ${escapeHtml(signal.novelty_score)}</span>
        <span class="chip">Confidence ${escapeHtml(signal.confidence_score)}</span>
        <span class="chip">Query: ${escapeHtml(signal.query_used)}</span>
      </div>
      ${renderFeedbackForm(signal)}
    </article>`;
  };
  const groupedSignalCards = Object.entries(groupedSignals)
    .map(
      ([lane, laneSignals]) =>
        `<section class="list"><div class="card"><h2>${escapeHtml(lane)}</h2><p>${laneSignals.length} sourced signal(s)</p></div>${laneSignals.map(renderSignalCard).join("")}</section>`
    )
    .join("");
  const executiveSummary = signals.length
    ? `<section class="card" style="margin-top:18px"><h2>Executive Summary</h2><div class="grid">
        <p><strong>Best move-forward signal:</strong> ${escapeHtml(bestSignal ? opportunityHeadline(bestSignal) : "No strong signal yet.")}</p>
        <p><strong>Strongest lane:</strong> ${escapeHtml(bestSignal ? signalLane(bestSignal) : "No strong lane yet")}</p>
        <p><strong>Likely buyer/partner set:</strong> ${escapeHtml(buyers.length ? buyers.join(", ") : "Needs review")}</p>
      </div>${moveForwardSignals.length ? "" : `<p style="background:#fffbeb; color:#78350f; padding:10px; border-radius:6px">This scan found market evidence, but no high-confidence current opportunity to move forward without additional active-source checks.</p>`}</section>`
    : "";
  return page(
    "Opportunity Scan",
    `<main class="wrap">
      <p><a href="/">Back to scan form</a> &nbsp; <a href="/admin/reports">Completed scans</a></p>
      <section class="card">
        <p class="eyebrow">Opportunity Scan</p>
        <div class="split">
          <div>
            <h1>${escapeHtml(profile?.company_name || scan.company_name || scan.company_url)}</h1>
            <p>This scan translates the company into public-sector opportunity lanes, then checks external public sources for sourced buying, funding, and policy signals.</p>
          </div>
          <div><div class="status">Status: <strong>${escapeHtml(scan.status)}</strong></div><br><br><div class="status">Access: <strong>${escapeHtml(isUnlocked ? "Full scan" : "Free preview")}</strong></div></div>
        </div>
      </section>
      ${options.unlock === "placeholder" ? `<section class="card" style="margin-top:18px; background:#eff6ff; border-color:#bfdbfe; color:#1e3a8a">Payment is not connected yet. This placeholder shows where the $99 unlock flow will open the full report, exports, and enrichment workflow.</section>` : ""}
      ${scan.status === "failed" ? `<section class="card error">${escapeHtml(scan.error_message || "The scan failed.")}</section>` : ""}
      ${profile ? `<section class="card" style="margin-top:18px"><div class="split"><div><h2>${isCreativeReport ? "Revenue-Ready Opportunities" : "Actionable Opportunities"}</h2><p>${isCreativeReport ? "This view prioritizes public buyers and funded recipients with clear live music, performer, concert, event entertainment, or public event production needs." : "This view separates move-forward opportunity signals from older market evidence, so the report does not treat every public record as equally actionable."}</p></div><div class="status">${moveForwardSignals.length} actionable signal(s)</div></div></section>
      ${moveForwardSignals.length ? `${executiveSummary}${displayedSignals.length ? renderCleanSignalTable(displayedSignals) : ""}${!isUnlocked ? renderLockedPreview() : ""}${renderResearchDetails()}` : `<section class="card" style="margin-top:18px; background:#fffbeb; border-color:#fde68a"><h2>No Move-Forward Signals Found</h2><p style="color:#78350f">The scan found some background market evidence, but nothing current and actionable enough to surface as a recommended next step. Add active-source connectors like SAM.gov and Grants.gov or conduct analyst review.</p></section>${renderResearchDetails()}`}
      ${false && isUnlocked && priorExampleSignals.length ? `<section class="list" style="margin-top:18px"><div class="card"><h2>Market Evidence / Prior Buying Patterns</h2><p>These are not current leads. They are included because they show adjacent public spending patterns that can help find current buyers, funded recipients, or partners.</p></div>${priorExampleSignals.map(renderPriorExampleCard).join("")}</section>` : ""}
      ` : `<section class="card">No company profile has been generated yet.</section>`}
    </main>`
  );
}

function renderAdmin(rows) {
  return page(
    "Completed Scans",
    `<main class="wrap">
      <p><a href="/">Back to scan form</a> &nbsp; <a href="/admin/sources">Source coverage</a> &nbsp; <a href="/admin/feedback">Feedback</a></p>
      <div class="split"><div><h1>Completed Scans</h1><p>Review completed scans, source coverage, opportunity signals, and search strategy details.</p></div><div class="status">${rows.length} completed</div></div>
      <section class="card list">
        ${rows.length === 0 ? `<p>No completed scans yet. Run a scan from the form to populate this view.</p>` : rows.map(({ scan, profile }) => {
          const terms = profile?.profile_json.public_sector_search_terms || [];
          const playbooks = profile?.profile_json.selected_playbooks || scan.selected_playbooks || [];
          return `<article class="split" style="border-bottom:1px solid #d8dee9; padding-bottom:14px">
            <div>
              <h2>${escapeHtml(profile?.profile_json.company_name || scan.company_name || scan.company_url)}</h2>
              <p>${escapeHtml(scan.company_url)}</p>
              <p>${escapeHtml(profile?.profile_json.summary || "Profile summary unavailable.")}</p>
              <div class="chips">${playbooks.slice(0, 3).map((playbook) => `<span class="chip">${escapeHtml(playbook.name)}</span>`).join("")}${terms.slice(0, 8).map((term) => `<span class="chip">${escapeHtml(term)}</span>`).join("")}</div>
            </div>
            <div><p class="status">${escapeHtml(scan.report_type === "deep" ? "Deep Scan" : "Quick Scan")}</p><p><a class="button" href="/reports/${scan.id}?access=admin">View full report</a></p></div>
          </article>`;
        }).join("")}
      </section>
    </main>`
  );
}

function renderFeedbackAdmin(rows) {
  const moreLikeThis = rows.filter((row) => row.feedback.feedback_kind === "more_like_this").length;
  const lessLikeThis = rows.filter((row) => row.feedback.feedback_kind === "less_like_this").length;
  const headline = (signal) => {
    if (!signal?.opportunity_title) return "Scan-level feedback";
    const match = String(signal.opportunity_title).match(/^(.+?) received (\$[^:]+): (.+)$/);
    if (match) {
      const [, recipient, amount, lane] = match;
      return `${lane}: ${recipient} funded ${amount}`;
    }
    return signal.opportunity_title;
  };

  return page(
    "Feedback Review",
    `<main class="wrap">
      <p><a href="/admin/reports">Back to completed scans</a> &nbsp; <a href="/admin/sources">Source coverage</a></p>
      <section class="card">
        <div class="split">
          <div>
            <h1>Feedback Review</h1>
            <p>Review good-fit and bad-fit labels so future playbook, query, and connector tuning can follow actual user judgment.</p>
          </div>
          <div><div class="status">${moreLikeThis} more like this</div><br><br><div class="status">${lessLikeThis} less like this</div></div>
        </div>
      </section>
      <section class="card" style="margin-top:18px; overflow-x:auto">
        ${rows.length === 0 ? `<p>No feedback has been submitted yet.</p>` : `<table style="width:100%; min-width:1020px; border-collapse:collapse; font-size:13px">
          <thead><tr style="background:#f5f7fb; color:#64748b; text-transform:uppercase; letter-spacing:.04em">
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Feedback</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Company</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Signal</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Reason</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Created</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Links</th>
          </tr></thead>
          <tbody>${rows.map(({ feedback, scan, signal }) => `<tr style="vertical-align:top">
            <td style="padding:10px; border-bottom:1px solid #d8dee9"><span class="chip">${escapeHtml(feedback.feedback_kind === "more_like_this" ? "More like this" : "Less like this")}</span></td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:180px">${escapeHtml(scan?.company_name || scan?.company_url || "Unknown scan")}</td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:280px"><strong>${escapeHtml(headline(signal))}</strong>${signal ? `<br><span style="color:#64748b">${escapeHtml(signal.source_name)} / ${escapeHtml(sourceTypeLabel(signal))}</span>` : ""}</td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9; max-width:260px">${escapeHtml(feedback.reason || "No reason provided.")}</td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(new Date(feedback.created_at).toLocaleString())}</td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9"><a href="/reports/${escapeHtml(feedback.scan_id)}?access=admin">Report</a>${feedback.opportunity_id ? ` &nbsp; <a href="/opportunities/${escapeHtml(feedback.opportunity_id)}?scanId=${escapeHtml(feedback.scan_id)}">Opportunity</a>` : ""}</td>
          </tr>`).join("")}</tbody>
        </table>`}
      </section>
    </main>`
  );
}

function renderSourcesAdmin() {
  const rows = [
    ["Company website", "Active", "None", "Builds the company profile and search strategy.", "Keep improving profile extraction and logo detection."],
    ["USAspending.gov", "Active", "None", "Finds historical awards, funded buyers, and money-flow patterns.", "Keep using as market-map evidence and prior buying patterns."],
    ["Federal Register", "Active", "None", "Finds policy and regulatory demand signals.", "Pair policy results with buyer, grant, or procurement paths before surfacing as actionable."],
    ["SAM.gov", isSamGovConfigured() ? "Active" : "Needs API key", "SAM_API_KEY", "Finds active solicitations, sources sought, special notices, and award notices.", "Add API key, then test Jammcard, SchoolGig, and Reparel before broadening terms."],
    ["Grants.gov", "Active", "None", "Finds active and forecasted grant/funding opportunities plus source-listed grant program contacts.", "Use grant contacts for eligibility/program questions; identify grantees or eligible applicants for sales outreach."],
    ["State/local portals", "Active", "Varies", "Routes searches into city, county, state, school, arts, parks, tourism, and procurement portals.", "Replace high-value portal routes with deeper scrapers/API integrations as we validate repeatable sources."],
    ["Snov contact enrichment", isSnovConfigured() ? "Active" : "Needs API key", "SNOV_CLIENT_ID / SNOV_CLIENT_SECRET", "Finds role-aligned contact candidates after a buyer or recipient domain is verified.", "Add buyer-domain resolution before spending Snov lookup credits."],
    ["Apollo / Prospeo / People Data Labs / Hunter", process.env.APOLLO_API_KEY || process.env.PROSPEO_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY || process.env.HUNTER_API_KEY ? "Available" : "Needs API key", "APOLLO_API_KEY / PROSPEO_API_KEY / PEOPLE_DATA_LABS_API_KEY / HUNTER_API_KEY", "Adds additional contact discovery, email verification, and person/company enrichment options.", "Use after role targeting and domain resolution so enrichment returns decision-makers, not random contacts."],
    ["Clay enrichment orchestration", process.env.CLAY_API_KEY ? "Available" : "Needs API key", "CLAY_API_KEY", "Potential workflow/export layer for running enrichment tables once the opportunity list is qualified.", "Choose the exact Clay workflow endpoint before wiring production calls."]
  ];
  return page(
    "Source Coverage",
    `<main class="wrap">
      <p><a href="/admin/reports">Back to completed scans</a></p>
      <section class="card">
        <h1>Source Coverage</h1>
        <p>Connector status for the opportunity engine. Add one source at a time, test report quality, tune playbooks, then move to the next source.</p>
      </section>
      <section class="card" style="margin-top:18px; overflow-x:auto">
        <table style="width:100%; min-width:880px; border-collapse:collapse; font-size:13px">
          <thead><tr style="background:#f5f7fb; color:#64748b; text-transform:uppercase; letter-spacing:.04em">
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Source</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Status</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Key</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Value</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid #d8dee9">Next Test</th>
          </tr></thead>
          <tbody>${rows.map(([source, status, key, value, next]) => `<tr>
            <td style="padding:10px; border-bottom:1px solid #d8dee9"><strong>${escapeHtml(source)}</strong></td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9"><span class="chip">${escapeHtml(status)}</span></td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(key)}</td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(value)}</td>
            <td style="padding:10px; border-bottom:1px solid #d8dee9">${escapeHtml(next)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </section>
    </main>`
  );
}

async function handleScan(req, res) {
  const body = await collectBody(req);
  const form = new URLSearchParams(body);
  let companyUrl;
  try {
    companyUrl = normalizeUrl(form.get("companyUrl") || "");
  } catch {
    redirect(res, "/?error=invalid-url");
    return;
  }

  const now = new Date().toISOString();
  const scan = {
    id: randomUUID(),
    company_url: companyUrl,
    company_name: form.get("companyName") || null,
    headquarters_state: form.get("headquartersState") || null,
    target_states: form.get("targetStates") || null,
    industry: form.get("industry") || null,
    customer_type: form.get("customerType") || null,
    email: form.get("email") || null,
    report_type: form.get("reportType") || "quick",
    report_access: "free",
    opportunity_focus: form.get("opportunityFocus") || null,
    include_terms: form.get("includeTerms") || null,
    exclude_terms: form.get("excludeTerms") || null,
    priority_signals: form.getAll("prioritySignals").filter(Boolean),
    selected_playbooks: [],
    status: "queued",
    error_message: null,
    created_at: now,
    completed_at: null
  };

  const db = await readDb();
  db.scans.push(scan);
  await writeDb(db);

  try {
    scan.status = "scraping";
    await writeDb(db);
    const scraped = await scrapeCompanyWebsite(companyUrl);
    scan.status = "profiling";
    await writeDb(db);
    const profile = generateProfile(scan, scraped.rawText);
    db.company_profiles.push({
      id: randomUUID(),
      scan_id: scan.id,
      profile_json: profile,
      raw_text: scraped.rawText,
      scraped_pages: scraped.pages,
      created_at: new Date().toISOString()
    });
    scan.selected_playbooks = profile.selected_playbooks || [];
    scan.status = "discovering";
    await writeDb(db);
    const signals = await discoverExternalSignals(profile);
    saveSignalsToDb(db, scan.id, signals);
    scan.status = "completed";
    scan.completed_at = new Date().toISOString();
  } catch (error) {
    scan.status = "failed";
    scan.error_message = error instanceof Error ? error.message : "Unknown scan error";
  }

  await writeDb(db);
  redirect(res, `/reports/${scan.id}`);
}

function renderOpportunityProfile(scan, profileRecord, signal, enrichmentRequests = [], enrichmentSaved = false) {
  const profile = profileRecord?.profile_json || null;
  const opportunityHeadline = (item) => {
    const match = String(item.opportunity_title || "").match(/^(.+?) received (\$[^:]+): (.+)$/);
    if (match) {
      return `${match[3]}: ${match[1]} funded ${match[2]}`;
    }
    return item.opportunity_title || "Untitled opportunity";
  };
  const laneReason = (signal.reasoning || []).find((item) => item.startsWith("Inferred lane:"));
  const lane = laneReason?.replace("Inferred lane:", "").trim() || signal.revenue_pathway.replaceAll("_", " ");
  const actionability = {
    actionability: signal.actionability || "maybe",
    reason: signal.actionability_reason || "This signal appears adjacent enough to review, but buyer fit should be validated.",
    bestNextStep: signal.best_next_step || signal.recommended_action || "Review buyer, source record, and contact path."
  };
  const routeLabel = (() => {
    if (signal.revenue_pathway === "sell_to_agency" || signal.revenue_pathway === "procurement_bid") return "Agency/procurement route";
    if (signal.revenue_pathway === "sell_to_grantee" || signal.revenue_pathway === "partner_with_recipient") return "Funded-buyer or partner route";
    if (signal.revenue_pathway === "direct_apply") return "Direct-apply route";
    if (signal.revenue_pathway === "monitor_policy") return "Policy/admin monitoring route";
    return "Channel or market-mapping route";
  })();
  const contactSearchUrl = (() => {
    const target = signal.likely_buyer_or_partner || signal.agency_or_funder || "";
    const query = [target, lane, "procurement contact program manager partnerships"].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  })();
  const startDate = typeof signal.raw_json?.["Start Date"] === "string" ? signal.raw_json["Start Date"] : "";
  const endDate = signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");
  const sourceType = signal.source_type === "historical_award" && endDate >= "2026-06-29"
    ? "current funded program"
    : String(signal.source_type || "").replaceAll("_", " ");
  const sourceContactIsActionable = (signal.source_name === "SAM.gov" && (
    signal.source_type === "active_contract" ||
    signal.source_type === "procurement_category" ||
    signal.revenue_pathway === "procurement_bid" ||
    signal.revenue_pathway === "sell_to_agency"
  )) || (signal.source_name === "Grants.gov" && signal.revenue_pathway === "direct_apply");
  const sourceContacts = sourceContactIsActionable && Array.isArray(signal.raw_json?.pointOfContact) ? signal.raw_json.pointOfContact : [];
  const sourceContact = sourceContacts.find((item) => item && typeof item === "object" && (item.fullName || item.fullname || item.title || item.email || item.phone));
  const contactRoles = (() => {
    const text = [lane, signal.opportunity_title, signal.external_evidence_summary, signal.query_used].join(" ").toLowerCase();
    if (/tourism|parks|recreation|placemaking|public space|public plaza|open streets|downtown|bid|business improvement district|city of|county/.test(text)) return ["Special Events Manager", "Cultural Affairs Manager", "Parks and Recreation Director", "Tourism or Downtown Partnership Director", "Procurement Specialist"];
    if (/symphony|performing arts|arts council|artist|musician|concert|live music|event entertainment|booking/.test(text)) return ["Executive Director", "Programming Director", "Events or Production Manager", "Partnerships Director", "Grants Manager"];
    if (/school|district|education|teaching artist|arts education|enrichment/.test(text)) return ["Arts Coordinator", "Enrichment Program Director", "CTE or Workforce Program Director", "Procurement Specialist"];
    return ["Program Director", "Procurement Specialist", "Partnerships Director", "Grants Manager"];
  })();
  const primaryContact = {
    organization: signal.likely_buyer_or_partner || signal.agency_or_funder || "Buyer or funded organization",
    name: sourceContact?.fullName || sourceContact?.fullname || "",
    title: sourceContact?.title || sourceContact?.type || "",
    email: sourceContact?.email || "",
    phone: sourceContact?.phone || "",
    roles: sourceContact ? [sourceContact.title || sourceContact.type || "Source-listed point of contact"] : contactRoles,
    outreachAngle: "Lead with the source record, explain the relevant fit in one sentence, and ask who owns vendor, partner, or program decisions."
  };
  const verifiedContactCount = primaryContact.name || primaryContact.email || primaryContact.phone ? 1 : 0;
  const targetRoleCount = [...new Set(primaryContact.roles || [])].length;
  const contactStatusLabel = verifiedContactCount > 0
    ? `${verifiedContactCount} verified contact${verifiedContactCount === 1 ? "" : "s"}`
    : "0 verified contacts";
  const contactDetailLabel = verifiedContactCount > 0
    ? `${targetRoleCount} relevant role${targetRoleCount === 1 ? "" : "s"} mapped`
    : `${targetRoleCount} target role${targetRoleCount === 1 ? "" : "s"} identified`;
  const primaryContactSearchUrl = `https://www.google.com/search?q=${encodeURIComponent([primaryContact.organization, primaryContact.name || primaryContact.roles.slice(0, 3).join(" OR "), primaryContact.email ? "" : "email contact"].filter(Boolean).join(" "))}`;
  const enrichmentActions = [
    ["find_contacts", "Find contacts", "Identify buyer, program, procurement, or partnership contacts."],
    ["find_similar_awards", "Find similar awards", "Use this signal as a pattern to find adjacent funded buyers."],
    ["search_active_bids", "Search active bids", "Look for open solicitations that match this lane."],
    ["search_grants", "Search grants", "Check whether this buyer or category has current funding programs."],
    ["find_buyer_website", "Find buyer website", "Find the agency, department, procurement, or program page."],
    ["generate_outreach", "Generate outreach angle", "Draft the sales or partnership hypothesis for this signal."]
  ];

  return page(
    "Opportunity Profile",
    `<main class="wrap">
      <p><a href="/reports/${escapeHtml(scan.id)}">Back to report</a> &nbsp; <a href="/">New scan</a></p>
      ${enrichmentSaved ? `<section class="card" style="background:#ecfdf5; border-color:#bbf7d0; color:#166534">Enrichment request saved. This is now in the work queue for this opportunity.</section>` : ""}
      <section class="card">
        <p class="eyebrow">Opportunity Profile</p>
        <div class="split">
          <div>
            <h1>${escapeHtml(opportunityHeadline(signal))}</h1>
            <p>For ${escapeHtml(profile?.company_name || scan.company_name || scan.company_url)}. This page turns one signal into a sales, partner, or research work item.</p>
          </div>
          <div class="status">${escapeHtml(actionability.actionability === "yes" ? "Yes" : "Maybe")} to move forward</div>
        </div>
      </section>
      <section class="grid" style="margin-top:18px">
        <div class="card"><h2>Lane</h2><p><strong>${escapeHtml(lane)}</strong></p><p>${escapeHtml(routeLabel)}</p></div>
        <div class="card"><h2>Buyer / Partner</h2><p><strong>${escapeHtml(signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review")}</strong></p><p>${escapeHtml(signal.geography || "Geography needs review")}</p></div>
        <div class="card"><h2>Scores</h2><p><strong>R ${escapeHtml(signal.relevance_score)} / N ${escapeHtml(signal.novelty_score)} / C ${escapeHtml(signal.confidence_score)}</strong></p><p>${escapeHtml(signal.source_name)}</p></div>
      </section>
      <section class="card" style="margin-top:18px">
        <h2>Why This Is Actionable</h2>
        <p>${escapeHtml(actionability.reason)}</p>
        <p style="border:1px solid #d8dee9; border-radius:6px; padding:8px"><strong>Best next step:</strong> ${escapeHtml(actionability.bestNextStep)}</p>
      </section>
      <section class="card" style="margin-top:18px">
        <div class="grid">
          <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Contact Status</h2><p><strong>${escapeHtml(contactStatusLabel)}</strong></p><p>${escapeHtml(contactDetailLabel)}</p></div>
          <div class="card" style="box-shadow:none; background:#f5f7fb"><h2>Contact Discovery</h2><p>This separates verified source contacts from role targets that still need enrichment.</p></div>
          <form action="/api/opportunities/enrich" method="post" class="card" style="box-shadow:none; background:#f5f7fb">
            <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
            <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
            <input type="hidden" name="enrichmentType" value="find_contacts">
            <h2>Enrich contacts</h2>
            <p>Find named people and contact info for this opportunity.</p>
            <button>Enrich contacts</button>
          </form>
        </div>
      </section>
      <section class="card" style="margin-top:18px">
        <div class="split"><div><h2>Who To Contact First</h2><p>Start with the person or roles most likely to own programming, procurement, partnership, or the funded program.</p></div><a class="button" href="${escapeHtml(primaryContactSearchUrl)}" target="_blank">Search primary contacts</a></div>
        <div class="card" style="margin-top:14px; box-shadow:none; background:#f5f7fb">
          <h2>${escapeHtml(primaryContact.organization)}</h2>
          ${primaryContact.name ? `<p><strong>Name:</strong> ${escapeHtml(primaryContact.name)}</p>` : ""}
          ${primaryContact.title ? `<p><strong>Title:</strong> ${escapeHtml(primaryContact.title)}</p>` : ""}
          ${primaryContact.email ? `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(primaryContact.email)}">${escapeHtml(primaryContact.email)}</a></p>` : ""}
          ${primaryContact.phone ? `<p><strong>Phone:</strong> ${escapeHtml(primaryContact.phone)}</p>` : ""}
          <div class="chips">${primaryContact.roles.map((role) => `<span class="chip">${escapeHtml(role)}</span>`).join("")}</div>
          <p><strong>Outreach angle:</strong> ${escapeHtml(primaryContact.outreachAngle)}</p>
        </div>
      </section>
      <section class="grid" style="margin-top:18px">
        <div class="card">
          <h2>Source Evidence</h2>
          <p>${escapeHtml(signal.external_evidence_summary)}</p>
          <p><strong>Source type:</strong> ${escapeHtml(sourceType)}</p>
          <p><strong>Query used:</strong> ${escapeHtml(signal.query_used || "Needs review")}</p>
          <p><strong>Start:</strong> ${escapeHtml(startDate || "Unknown")} &nbsp; <strong>End/deadline:</strong> ${escapeHtml(endDate || "Unknown")}</p>
          <p><a class="button" href="${escapeHtml(signal.source_url)}" target="_blank">Open source record</a></p>
        </div>
        <div class="card">
          <h2>Contact Path</h2>
          <p>Start with the buyer or program owner, then validate procurement, partnership, or funded-recipient path before outreach.</p>
          <p><a class="button" href="${escapeHtml(contactSearchUrl)}" target="_blank">Find contacts</a></p>
        </div>
      </section>
      <section class="card" style="margin-top:18px">
        <h2>Enrich This Opportunity</h2>
        <p>These actions create enrichment requests for the opportunity. The first product version logs the request; the next connector milestone can automatically complete the highest-demand actions.</p>
        <div class="grid">
          ${enrichmentActions.map(([type, label, description]) => `<form action="/api/opportunities/enrich" method="post" class="card" style="box-shadow:none; background:#f5f7fb">
            <input type="hidden" name="scanId" value="${escapeHtml(scan.id)}">
            <input type="hidden" name="opportunityId" value="${escapeHtml(signal.id || "")}">
            <input type="hidden" name="enrichmentType" value="${escapeHtml(type)}">
            <h2>${escapeHtml(label)}</h2>
            <p>${escapeHtml(description)}</p>
            <button>Request enrichment</button>
          </form>`).join("")}
        </div>
      </section>
      <section class="card" style="margin-top:18px">
        <h2>Reasoning And Next Steps</h2>
        <p><strong>Why it matters:</strong> ${escapeHtml(signal.why_it_matters)}</p>
        <p><strong>Recommended action:</strong> ${escapeHtml(signal.recommended_action)}</p>
        ${(signal.reasoning || []).length ? `<div class="chips">${(signal.reasoning || []).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      </section>
      <section class="card" style="margin-top:18px">
        <h2>Enrichment History</h2>
        ${enrichmentRequests.length ? enrichmentRequests.map((request) => {
          const result = request.result_json || {};
          const contacts = Array.isArray(result.contacts) ? result.contacts : [];
          return `<div style="border:1px solid #d8dee9; border-radius:6px; padding:10px; margin-bottom:8px">
            <p><strong>${escapeHtml(request.enrichment_type.replaceAll("_", " "))}</strong> - ${escapeHtml(request.status)} on ${escapeHtml(new Date(request.created_at).toLocaleDateString())}</p>
            ${result.message ? `<p>${escapeHtml(result.message)}</p>` : ""}
            ${contacts.length ? `<div class="grid">${contacts.map((contact) => `<div class="card" style="box-shadow:none; background:#fff">
              <p><strong>${escapeHtml(contact.name || contact.email || "Contact candidate")}</strong></p>
              ${contact.title ? `<p>${escapeHtml(contact.title)}</p>` : ""}
              ${contact.email ? `<p><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></p>` : ""}
              ${contact.confidence ? `<p><span class="chip">${escapeHtml(contact.confidence)} confidence</span></p>` : ""}
            </div>`).join("")}</div>` : ""}
          </div>`;
        }).join("") : `<p>No enrichment requests yet.</p>`}
      </section>
    </main>`
  );
}

async function handleFeedback(req, res) {
  const body = await collectBody(req);
  const form = new URLSearchParams(body);
  const scanId = form.get("scanId") || "";
  const opportunityId = form.get("opportunityId") || null;
  const feedbackKind = form.get("feedbackKind") || "";
  const reason = (form.get("reason") || "").trim() || null;

  if (!scanId || !["more_like_this", "less_like_this"].includes(feedbackKind)) {
    send(res, page("Invalid Feedback", `<main class="wrap"><h1>Invalid feedback</h1><p><a href="/">Back to scan form</a></p></main>`), 400);
    return;
  }

  const db = await readDb();
  db.report_feedback.push({
    id: randomUUID(),
    scan_id: scanId,
    opportunity_id: opportunityId,
    feedback_kind: feedbackKind,
    reason,
    created_at: new Date().toISOString()
  });
  await writeDb(db);
  redirect(res, `/reports/${scanId}?feedback=saved`);
}

async function handleHideOpportunity(req, res) {
  const body = await collectBody(req);
  const form = new URLSearchParams(body);
  const scanId = form.get("scanId") || "";
  const opportunityId = form.get("opportunityId") || "";

  if (!scanId || !opportunityId) {
    send(res, page("Invalid Opportunity", `<main class="wrap"><h1>Invalid opportunity</h1><p><a href="/">Back to scan form</a></p></main>`), 400);
    return;
  }

  const db = await readDb();
  db.scan_opportunities = db.scan_opportunities.map((item) =>
    item.scan_id === scanId && item.opportunity_id === opportunityId ? { ...item, hidden: true } : item
  );
  db.report_feedback.push({
    id: randomUUID(),
    scan_id: scanId,
    opportunity_id: opportunityId,
    feedback_kind: "less_like_this",
    reason: "Hidden from actionable table",
    created_at: new Date().toISOString()
  });
  await writeDb(db);
  redirect(res, `/reports/${scanId}?feedback=hidden`);
}

function isSnovConfigured() {
  return Boolean(process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET);
}

function cleanDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

function usefulEnrichmentDomain(domain) {
  return Boolean(domain) && !/(^|\.)?(usaspending|sam|grants|regulations|federalregister|opengov|google)\./i.test(domain);
}

function domainFromSignal(signal) {
  const raw = signal.raw_json || {};
  const nestedRaw = raw.raw_json && typeof raw.raw_json === "object" ? raw.raw_json : {};
  return [
    raw.buyer_domain,
    raw.buyerDomain,
    raw.organization_domain,
    raw.organizationDomain,
    raw.website,
    raw.buyer_website,
    raw.buyerWebsite,
    nestedRaw.buyer_domain,
    nestedRaw.buyerDomain,
    nestedRaw.website,
    nestedRaw.buyer_website
  ].filter((value) => typeof value === "string").map(cleanDomain).find(usefulEnrichmentDomain) || "";
}

function contactRolesForSignal(signal) {
  const laneReason = (signal.reasoning || []).find((item) => String(item).startsWith("Inferred lane:"));
  const lane = laneReason?.replace("Inferred lane:", "").trim() || "";
  const text = [lane, signal.opportunity_title, signal.external_evidence_summary, signal.query_used].join(" ").toLowerCase();
  if (/tourism|parks|recreation|placemaking|public space|public plaza|open streets|downtown|bid|business improvement district|city of|county/.test(text)) return ["Special Events Manager", "Cultural Affairs Manager", "Parks and Recreation Director", "Tourism or Downtown Partnership Director", "Procurement Specialist"];
  if (/symphony|performing arts|arts council|artist|musician|concert|live music|event entertainment|booking/.test(text)) return ["Executive Director", "Programming Director", "Events or Production Manager", "Partnerships Director", "Grants Manager"];
  if (/school|district|education|teaching artist|arts education|enrichment/.test(text)) return ["Arts Coordinator", "Enrichment Program Director", "CTE or Workforce Program Director", "Procurement Specialist"];
  if (/teacher|educator|recruiting|job board|talent|human resources/.test(text)) return ["HR Director", "Chief Talent Officer", "Recruitment Director", "Procurement Specialist"];
  return ["Program Director", "Procurement Specialist", "Partnerships Director", "Grants Manager"];
}

async function snovAccessToken() {
  const response = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SNOV_CLIENT_ID || "",
      client_secret: process.env.SNOV_CLIENT_SECRET || ""
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Snov auth failed: HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("Snov auth failed: no access token returned");
  return data.access_token;
}

function contactFitScore(contact, roles) {
  const title = String(contact.position || "").toLowerCase();
  let score = 30;
  for (const role of roles) {
    for (const token of String(role).toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length >= 4)) {
      if (title.includes(token)) score += 18;
    }
  }
  if (/director|manager|coordinator|procurement|contract|buyer|program|events|arts|culture|tourism|parks|grants|workforce|talent|hr|human resources/.test(title)) score += 24;
  if (/assistant|intern|student|volunteer/.test(title)) score -= 20;
  return Math.max(0, Math.min(100, score));
}

async function enrichContactsWithSnovLocal(signal) {
  const organization = signal.likely_buyer_or_partner || signal.agency_or_funder || "Target organization";
  const targetRoles = contactRolesForSignal(signal);
  const domain = domainFromSignal(signal);
  if (!isSnovConfigured()) {
    return { provider: "snov", status: "not_configured", organization, target_roles: targetRoles, contacts: [], message: "Snov credentials are not configured." };
  }
  if (!domain) {
    return {
      provider: "snov",
      status: "needs_domain",
      organization,
      target_roles: targetRoles,
      contacts: [],
      message: "The opportunity has a target organization and contact roles, but no verified organization domain yet. Resolve the buyer/recipient website before running Snov contact lookup."
    };
  }
  try {
    const accessToken = await snovAccessToken();
    const params = new URLSearchParams({ access_token: accessToken, domain, type: "all", limit: "10" });
    const response = await fetch(`https://api.snov.io/v1/get-domain-emails-with-info?${params}`);
    const text = await response.text();
    if (!response.ok) throw new Error(`Snov domain lookup failed: HTTP ${response.status}: ${text.slice(0, 160)}`);
    const data = JSON.parse(text);
    const contacts = (data.emails || [])
      .filter((item) => item.email)
      .map((item) => {
        const score = contactFitScore(item, targetRoles);
        return {
          name: [item.firstName, item.lastName].filter(Boolean).join(" ").trim(),
          title: item.position || "",
          email: item.email || "",
          source_url: item.sourcePage,
          confidence: score >= 72 ? "high" : score >= 52 ? "medium" : "low",
          rationale: score >= 52 ? "Title appears aligned with the opportunity's recommended buyer or program-owner roles." : "Email is associated with the domain, but title alignment is weak and should be reviewed."
        };
      })
      .filter((item) => item.confidence !== "low")
      .slice(0, 5);
    return {
      provider: "snov",
      status: "completed",
      organization,
      domain,
      target_roles: targetRoles,
      contacts,
      message: contacts.length ? `Found ${contacts.length} role-aligned contact candidate(s) on ${domain}.` : `Snov returned domain emails for ${domain}, but none were role-aligned enough to recommend without review.`
    };
  } catch (error) {
    return { provider: "snov", status: "failed", organization, domain, target_roles: targetRoles, contacts: [], message: error instanceof Error ? error.message : String(error) };
  }
}

async function handleEnrichment(req, res) {
  const body = await collectBody(req);
  const form = new URLSearchParams(body);
  const scanId = form.get("scanId") || "";
  const opportunityId = form.get("opportunityId") || "";
  const enrichmentType = form.get("enrichmentType") || "";
  const allowedTypes = [
    "find_contacts",
    "find_similar_awards",
    "search_active_bids",
    "search_grants",
    "find_buyer_website",
    "generate_outreach"
  ];

  if (!scanId || !opportunityId || !allowedTypes.includes(enrichmentType)) {
    send(res, page("Invalid Enrichment", `<main class="wrap"><h1>Invalid enrichment request</h1><p><a href="/">Back to scan form</a></p></main>`), 400);
    return;
  }

  const db = await readDb();
  const signal = buildSignalsForScan(db, scanId).find((item) => item.id === opportunityId);
  let status = "requested";
  let resultJson = {};
  if (enrichmentType === "find_contacts") {
    const result = signal ? await enrichContactsWithSnovLocal(signal) : { message: "Opportunity not found.", contacts: [] };
    status = result.status === "failed" ? "failed" : "completed";
    resultJson = result;
  }
  db.opportunity_enrichment_requests.push({
    id: randomUUID(),
    scan_id: scanId,
    opportunity_id: opportunityId,
    enrichment_type: enrichmentType,
    status,
    result_json: resultJson,
    created_at: new Date().toISOString()
  });
  await writeDb(db);
  redirect(res, `/opportunities/${opportunityId}?scanId=${scanId}&enrichment=requested`);
}

function buildSignalsForScan(db, scanId) {
  return db.scan_opportunities
    .filter((item) => item.scan_id === scanId && item.hidden !== true)
    .map((scanOpportunity) => {
      const opportunity = db.opportunities.find((item) => item.id === scanOpportunity.opportunity_id);
      if (!opportunity) return null;
      return {
        ...opportunity.raw_json,
        id: opportunity.id,
        relevance_score: scanOpportunity.relevance_score,
        novelty_score: scanOpportunity.novelty_score,
        confidence_score: scanOpportunity.confidence_score,
        recommended_action: scanOpportunity.recommended_action,
        human_review_required: scanOpportunity.human_review_required,
        created_at: opportunity.created_at
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

function sourceLabelForExport(signal) {
  const endDate = signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");
  const sourceType = signal.source_type === "historical_award" && endDate >= "2026-06-29"
    ? "current funded program"
    : String(signal.source_type || "").replaceAll("_", " ");

  return `${signal.source_name} - ${sourceType}`;
}

function contactTargetForExport(signal) {
  const sourceContactIsActionable = (signal.source_name === "SAM.gov" && (
    signal.source_type === "active_contract" ||
    signal.source_type === "procurement_category" ||
    signal.revenue_pathway === "procurement_bid" ||
    signal.revenue_pathway === "sell_to_agency"
  )) || (signal.source_name === "Grants.gov" && signal.revenue_pathway === "direct_apply");
  const sourceContacts = sourceContactIsActionable && Array.isArray(signal.raw_json?.pointOfContact) ? signal.raw_json.pointOfContact : [];
  const sourceContact = sourceContacts.find((item) => item && typeof item === "object" && (item.fullName || item.fullname || item.title || item.email || item.phone));
  const organization = signal.likely_buyer_or_partner || signal.agency_or_funder || "Buyer or funded organization";
  const text = [signalLaneForExport(signal), signal.opportunity_title, signal.external_evidence_summary, signal.query_used].join(" ").toLowerCase();
  const roles = sourceContact
    ? [sourceContact.title || sourceContact.type || "Source-listed point of contact"]
    : /tourism|parks|recreation|placemaking|public space|public plaza|open streets|downtown|bid|business improvement district|city of|county/.test(text)
      ? ["Special Events Manager", "Cultural Affairs Manager", "Parks and Recreation Director", "Tourism or Downtown Partnership Director", "Procurement Specialist"]
      : /symphony|performing arts|arts council|artist|musician|concert|live music|event entertainment|booking/.test(text)
        ? ["Executive Director", "Programming Director", "Events or Production Manager", "Partnerships Director", "Grants Manager"]
        : ["Program Director", "Procurement Specialist", "Partnerships Director", "Grants Manager"];
  const name = sourceContact?.fullName || sourceContact?.fullname || "";
  const title = sourceContact?.title || sourceContact?.type || "";
  const email = sourceContact?.email || "";
  const phone = sourceContact?.phone || "";
  return {
    organization,
    name,
    title,
    email,
    phone,
    roles,
    why: sourceContact ? "Source-listed active procurement contact from SAM.gov." : "Role-based contact strategy inferred from lane and buyer type.",
    outreachAngle: "Lead with the source record, explain the relevant fit in one sentence, and ask who owns vendor, partner, or program decisions.",
    searchUrl: `https://www.google.com/search?q=${encodeURIComponent([organization, name || roles.slice(0, 3).join(" OR "), email ? "" : "email contact"].filter(Boolean).join(" "))}`
  };
}

async function handleExportReport(id, res) {
  const db = await readDb();
  const scan = db.scans.find((item) => item.id === id);
  if (!scan) {
    send(res, page("Not Found", `<main class="wrap"><h1>Scan not found</h1><p><a href="/">Back to scan form</a></p></main>`), 404);
    return;
  }
  const profile = db.company_profiles.filter((item) => item.scan_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.profile_json || null;
  const isCreativeReport = Boolean(profile?.selected_playbooks?.some((playbook) => playbook.playbook_id === "music_arts_creative_economy"));
  const signals = buildSignalsForScan(db, id).filter((signal) => assessActionabilityForExport(signal).actionability !== "unlikely");
  const sortedSignals = isCreativeReport
    ? sortByExportDirectRevenueFit(signals.filter(isExportDirectRevenueReadySignal))
    : signals;
  const rows = [
    ["Signal", "Lane", "Source", "Buyer / Partner", "Primary Contact Target", "Contact Name", "Contact Title", "Contact Email", "Contact Phone", "Suggested Contact Roles", "Contact Rationale", "Outreach Angle", "Contact Search URL", "Actionability", "Relevance", "Novelty", "Confidence", "Query", "Next Step", "URL"],
    ...sortedSignals.map((signal) => {
      const actionability = assessActionabilityForExport(signal);
      const contactTarget = contactTargetForExport(signal);
      return [
        signal.opportunity_title,
        signalLaneForExport(signal),
        sourceLabelForExport(signal),
        signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review",
        contactTarget.organization,
        contactTarget.name,
        contactTarget.title,
        contactTarget.email,
        contactTarget.phone,
        contactTarget.roles.join("; "),
        contactTarget.why,
        contactTarget.outreachAngle,
        contactTarget.searchUrl,
        actionability.actionability,
        signal.relevance_score,
        signal.novelty_score,
        signal.confidence_score,
        signal.query_used,
        actionability.bestNextStep,
        signal.source_url
      ];
    })
  ];
  sendCsv(res, rows.map((row) => row.map(csvCell).join(",")).join("\n"), `opportunity-scan-${id}.csv`);
}

function exportDirectRevenueFitScore(signal) {
  const lane = signalLaneForExport(signal).toLowerCase();
  const evidence = [
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.why_it_matters,
    signal.query_used,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    lane
  ].join(" ").toLowerCase();
  const endDate = signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");
  let score = signal.relevance_score + signal.confidence_score + signal.novelty_score;
  if (endDate >= "2026-06-29") score += 45;
  else if (endDate >= "2025-01-01") score += 18;
  else if (endDate) score -= 35;
  if (/live music|music performance|musical performance|musician services|performer services|performing artist|artist booking|event entertainment|festival entertainment|concert|summer concert|public concerts|public event production|event production services/.test(evidence)) score += 80;
  if (/city of|county|department of parks|parks recreation|tourism|downtown|business improvement district|bid programming|partnership|alliance|conservancy|greenway|public plaza|public space|open streets|night market|neighborhood festival|public venue|cultural affairs|arts commission|school district|university|academy|military band/.test(evidence)) score += 36;
  if (/event entertainment|musician services|live music|public concerts|summer concert|public event production|public space activation|downtown activation|district event programming/.test(evidence)) score += 25;
  if (lane.includes("school and district arts programming") || lane.includes("creative workforce") || lane.includes("arts and culture grants")) score -= 18;
  if (/visual arts|museum visit|graphic artist|workforce development|former incarcerated|case management|exhibition only/.test(evidence)) score -= 45;
  if (signal.source_type === "policy_signal") score -= 80;
  if (signal.revenue_pathway === "monitor_policy") score -= 60;
  return score;
}

function sortByExportDirectRevenueFit(signals) {
  return [...signals].sort((a, b) => exportDirectRevenueFitScore(b) - exportDirectRevenueFitScore(a));
}

function isExportDirectRevenueReadySignal(signal) {
  return exportDirectRevenueFitScore(signal) >= 330;
}

function signalLaneForExport(signal) {
  const laneReason = (signal.reasoning || []).find((item) => item.startsWith("Inferred lane:"));
  return laneReason?.replace("Inferred lane:", "").trim() || signal.revenue_pathway.replaceAll("_", " ");
}

function assessActionabilityForExport(signal) {
  const endDate = signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");
  if (endDate && endDate < "2026-06-29") {
    return {
      actionability: "unlikely",
      bestNextStep: "Hide from the actionable report; use only for internal pattern research."
    };
  }

  if (signal.revenue_pathway === "monitor_policy" || signal.source_type === "policy_signal") {
    return {
      actionability: "unlikely",
      bestNextStep: "Use as context only unless paired with an active contract, grant, buyer, or specific agency program."
    };
  }

  return {
    actionability: signal.actionability || "maybe",
    bestNextStep: signal.best_next_step || signal.recommended_action || "Review buyer, source record, and contact path."
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      send(res, renderHome(url.searchParams.get("error") ? "Enter a valid company website URL." : ""));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/scans") {
      await handleScan(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      await handleFeedback(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opportunities/hide") {
      await handleHideOpportunity(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opportunities/enrich") {
      await handleEnrichment(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/reports/") && url.pathname.endsWith("/export")) {
      const id = url.pathname.split("/").filter(Boolean)[2];
      await handleExportReport(id, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/opportunities/")) {
      const opportunityId = url.pathname.split("/").filter(Boolean)[1];
      const scanId = url.searchParams.get("scanId") || "";
      const db = await readDb();
      const scan = db.scans.find((item) => item.id === scanId);
      const profile = db.company_profiles.filter((item) => item.scan_id === scanId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
      const signal = buildSignalsForScan(db, scanId).find((item) => item.id === opportunityId);
      if (!scan || !signal) {
        send(res, page("Not Found", `<main class="wrap"><h1>Opportunity not found</h1><p><a href="/">Back to scan form</a></p></main>`), 404);
        return;
      }
      const enrichmentRequests = (db.opportunity_enrichment_requests || [])
        .filter((item) => item.scan_id === scanId && item.opportunity_id === opportunityId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      send(res, renderOpportunityProfile(scan, profile, signal, enrichmentRequests, url.searchParams.get("enrichment") === "requested"));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/reports/")) {
      const id = url.pathname.split("/").filter(Boolean)[1];
      const db = await readDb();
      const scan = db.scans.find((item) => item.id === id);
      if (!scan) {
        send(res, page("Not Found", `<main class="wrap"><h1>Scan not found</h1><p><a href="/">Back to scan form</a></p></main>`), 404);
        return;
      }
      const profile = db.company_profiles.filter((item) => item.scan_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
      const signals = buildSignalsForScan(db, id);
      send(res, renderReport(scan, profile, signals, {
        access: url.searchParams.get("access") || "",
        unlock: url.searchParams.get("unlock") || ""
      }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin/reports") {
      const db = await readDb();
      const rows = db.scans
        .filter((scan) => scan.status === "completed")
        .sort((a, b) => (b.completed_at || b.created_at).localeCompare(a.completed_at || a.created_at))
        .map((scan) => ({
          scan,
          profile: db.company_profiles.filter((item) => item.scan_id === scan.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
        }));
      send(res, renderAdmin(rows));
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin/sources") {
      send(res, renderSourcesAdmin());
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin/feedback") {
      const db = await readDb();
      const rows = [...(db.report_feedback || [])]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 150)
        .map((feedback) => {
          const scan = db.scans.find((item) => item.id === feedback.scan_id) || null;
          const signal = feedback.opportunity_id
            ? buildSignalsForScan(db, feedback.scan_id).find((item) => item.id === feedback.opportunity_id) || null
            : null;
          return { feedback, scan, signal };
        });
      send(res, renderFeedbackAdmin(rows));
      return;
    }

    send(res, page("Not Found", `<main class="wrap"><h1>Page not found</h1><p><a href="/">Back to scan form</a></p></main>`), 404);
  } catch (error) {
    send(res, page("Error", `<main class="wrap"><section class="card error">${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</section></main>`), 500);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Policy Opportunity Scanner preview is running at http://localhost:${port}`);
});
