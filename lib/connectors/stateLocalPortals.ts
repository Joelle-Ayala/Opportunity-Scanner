import { CompanyProfile, OpportunitySignal } from "../types";
import { clampScore, collectSearchTerms, inferSignalLane } from "./shared";

type PortalRoute = {
  id: string;
  name: string;
  geography: string;
  category: string;
  baseUrl: string;
  searchUrl: (query: string) => string;
  triggers: RegExp[];
  buyerRoles: string[];
};

const portals: PortalRoute[] = [
  {
    id: "nyc-passport",
    name: "NYC PASSPort Public Solicitations",
    geography: "New York City",
    category: "city_county_procurement",
    baseUrl: "https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public",
    searchUrl: () => "https://passport.cityofnewyork.us/page.aspx/en/rfp/request_browse_public",
    triggers: [/music|artist|arts|cultural|event|performance|tourism|placemaking/i],
    buyerRoles: ["Agency Chief Contracting Officer", "Cultural Affairs Program Manager", "Events or Public Programming Lead"]
  },
  {
    id: "seattle-opengov",
    name: "City of Seattle Procurement Portal",
    geography: "Seattle, WA",
    category: "city_county_procurement",
    baseUrl: "https://procurement.opengov.com/portal/seattle",
    searchUrl: (query) => `https://procurement.opengov.com/portal/seattle?search=${encodeURIComponent(query)}`,
    triggers: [/music|artist|arts|cultural|event|performance|parks|tourism|placemaking|education|workforce/i],
    buyerRoles: ["Procurement Contact", "Parks and Recreation Events Lead", "Arts and Culture Program Manager"]
  },
  {
    id: "la-ramp",
    name: "Los Angeles RAMP Opportunities",
    geography: "Los Angeles, CA",
    category: "city_county_procurement",
    baseUrl: "https://www.rampla.org/s/",
    searchUrl: (query) => `https://www.rampla.org/s/search/?q=${encodeURIComponent(query)}`,
    triggers: [/music|artist|arts|cultural|event|performance|tourism|placemaking|education|workforce/i],
    buyerRoles: ["Department Program Manager", "Contract Administrator", "Cultural Affairs or Recreation Lead"]
  },
  {
    id: "ca-eprocure",
    name: "California eProcure Event Search",
    geography: "California",
    category: "state_procurement",
    baseUrl: "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx",
    searchUrl: () => "https://caleprocure.ca.gov/pages/Events-BS3/event-search.aspx",
    triggers: [/health|medical|rehab|education|workforce|music|arts|event|training|supplier|services/i],
    buyerRoles: ["State Procurement Officer", "Department Program Manager", "Category Buyer"]
  },
  {
    id: "wa-webs",
    name: "Washington WEBS Bid Opportunities",
    geography: "Washington",
    category: "state_procurement",
    baseUrl: "https://pr-webs-vendor.des.wa.gov/",
    searchUrl: () => "https://pr-webs-vendor.des.wa.gov/",
    triggers: [/health|medical|rehab|education|workforce|music|arts|event|training|supplier|services/i],
    buyerRoles: ["State Buyer", "Agency Program Manager", "Procurement Coordinator"]
  },
  {
    id: "nasaa-directory",
    name: "State Arts Agency Directory",
    geography: "All states",
    category: "state_arts_councils",
    baseUrl: "https://nasaa-arts.org/state-arts-agencies/saa-directory/",
    searchUrl: () => "https://nasaa-arts.org/state-arts-agencies/saa-directory/",
    triggers: [/music|artist|arts|cultural|performance|creative|festival|tourism|placemaking/i],
    buyerRoles: ["Arts Program Director", "Grants Manager", "Creative Economy Program Lead"]
  },
  {
    id: "opengov-portal-network",
    name: "OpenGov Procurement Portal Network",
    geography: "State and local",
    category: "city_county_procurement",
    baseUrl: "https://procurement.opengov.com/portal",
    searchUrl: (query) => `https://procurement.opengov.com/portal?search=${encodeURIComponent(query)}`,
    triggers: [/procurement|bid|services|event|education|training|medical|supplier|music|arts|workforce/i],
    buyerRoles: ["Procurement Specialist", "Department Program Owner", "Vendor Registration Contact"]
  }
];

function isStateLocalSourceRequested(profile: CompanyProfile): boolean {
  const categories = [
    ...(profile.activated_source_categories ?? []),
    ...(profile.planned_source_categories ?? [])
  ].join(" ");

  return /state|local|city|county|school_district|procurement|parks|tourism|arts_council|education_department|workforce_board/i.test(
    categories
  );
}

function profileText(profile: CompanyProfile): string {
  return [
    profile.company_name,
    profile.summary,
    ...(profile.products_services ?? []),
    ...(profile.industries ?? []),
    ...(profile.keywords ?? []),
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

function selectPortals(profile: CompanyProfile): PortalRoute[] {
  const text = profileText(profile);
  return portals.filter((portal) => portal.triggers.some((trigger) => trigger.test(text))).slice(0, 6);
}

function portalSummary(portal: PortalRoute, term: string): string {
  return `${portal.name} is a state/local source route to check for "${term}" solicitations, vendor registration paths, and department-level program opportunities.`;
}

export async function searchStateLocalPortals(profile: CompanyProfile): Promise<OpportunitySignal[]> {
  if (!isStateLocalSourceRequested(profile)) {
    return [];
  }

  const terms = collectSearchTerms(profile, 10).filter((term) => term.length >= 4);
  const selectedPortals = selectPortals(profile);
  if (!terms.length || !selectedPortals.length) {
    return [];
  }

  // Portal routes are useful internally, but they are not opportunities.
  // Only return state/local records after a connector verifies a real posting,
  // source URL, deadline/timing, and buyer or contact path.
  return [];

  const signals: OpportunitySignal[] = [];
  const seen = new Set<string>();

  for (const portal of selectedPortals) {
    const term = terms.find((candidate) => portal.triggers.some((trigger) => trigger.test(candidate))) ?? terms[0];
    const sourceUrl = portal.searchUrl(term);
    const key = `${portal.id}:${term}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const lane = inferSignalLane(`${portal.name} ${term} ${portal.category}`, "State/local procurement route");
    signals.push({
      opportunity_title: `${portal.name}: search route for ${term}`,
      source_type: "procurement_category",
      source_name: "State/local portal routing",
      source_url: sourceUrl,
      agency_or_funder: portal.name,
      deadline: "",
      geography: portal.geography,
      external_evidence_summary: portalSummary(portal, term),
      why_it_matters:
        "Many local opportunities do not appear in federal databases. This route gives the scan a repeatable way to check city, state, school, tourism, parks, and arts procurement sources for current bids or vendor paths.",
      who_benefits: profile.company_name,
      likely_buyer_or_partner: portal.name,
      revenue_pathway: "procurement_bid",
      relevance_score: clampScore(58 + (portal.category.includes("arts") ? 8 : 0)),
      novelty_score: 62,
      confidence_score: 48,
      reasoning: [
        `Matched state/local source category: ${portal.category}`,
        `Matched search term: ${term}`,
        `Inferred lane: ${lane}`,
        "Portal route only: human review is required before treating this as a confirmed active opportunity."
      ],
      recommended_action: `Open the portal route, search "${term}", and verify whether there is a current solicitation, vendor list, or program contact.`,
      actionability: "maybe",
      actionability_reason:
        "This is a targeted state/local portal route, not yet a confirmed open solicitation with a deadline.",
      best_next_step: `Check ${portal.name} for current postings and contact one of these roles: ${portal.buyerRoles.join(", ")}.`,
      human_review_required: true,
      query_used: term,
      raw_json: {
        portal_id: portal.id,
        portal_category: portal.category,
        portal_base_url: portal.baseUrl,
        buyer_roles: portal.buyerRoles,
        source_note: "State/local portal route. Do not present as a confirmed bid until a solicitation record is verified."
      }
    });
  }

  return signals;
}
