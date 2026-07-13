import assert from "node:assert/strict";
import { applyPlaybooksToProfile, matchPlaybooks } from "../lib/playbooks.ts";
import type { CompanyProfile, ScanInput } from "../lib/types.ts";

const profile = (overrides: Partial<CompanyProfile> = {}): CompanyProfile => ({
  company_name: "Example Company",
  website: "https://example.com",
  summary: "",
  products_services: [],
  target_customers: [],
  industries: [],
  geographies: [],
  keywords: [],
  public_sector_search_terms: [],
  translated_public_sector_terms: [],
  negative_keywords: [],
  possible_naics: [],
  possible_psc: [],
  possible_soc: [],
  policy_sensitive_categories: [],
  opportunity_lanes: [],
  lane_search_terms: {},
  opportunity_categories: [],
  selected_playbooks: [],
  activated_source_categories: [],
  planned_source_categories: [],
  likely_revenue_motions: [],
  suggested_contact_roles: [],
  report_guidance: [],
  ...overrides
});

const input = (overrides: Partial<ScanInput> = {}): ScanInput => ({
  companyUrl: "https://example.com",
  reportType: "deep",
  ...overrides
});

const slugMatch = matchPlaybooks(
  profile(),
  input({ industry: "marketing-advertising-content-web-services", customerType: "B2B" })
);
assert.equal(slugMatch[0]?.playbook_id, "marketing_advertising_content_web_services");
assert.equal(slugMatch[0]?.name, "Marketing / Advertising / Content / Web Services");

const agencyProfile = profile({
  company_name: "Civic Message Studio",
  summary:
    "A marketing communications agency providing public outreach campaigns, media buying services, and government website redesign.",
  products_services: [
    "public information campaigns",
    "digital advertising services",
    "website accessibility services"
  ],
  target_customers: ["Government"]
});
const appliedAgency = applyPlaybooksToProfile(agencyProfile, input({ customerType: "Government" }));
assert.equal(appliedAgency.selected_playbooks[0]?.playbook_id, "marketing_advertising_content_web_services");
assert.ok(
  appliedAgency.opportunity_lanes.includes("Government website redesign, accessibility, and content services")
);
assert.ok(appliedAgency.public_sector_search_terms.includes("media buying services"));
assert.ok(appliedAgency.planned_source_categories.includes("sam.gov"));
assert.ok(appliedAgency.likely_revenue_motions.includes("sell_to_funded_buyer"));
assert.ok(appliedAgency.suggested_contact_roles.includes("Public Information Officer"));

const softwareProfile = profile({
  company_name: "MetricCloud",
  summary: "Marketing analytics software and a content management platform for product teams.",
  products_services: ["analytics platform", "content management software"],
  industries: ["software"],
  keywords: ["software", "data", "analytics", "platform"]
});
assert.equal(
  matchPlaybooks(softwareProfile).some(
    (playbook) => playbook.playbook_id === "marketing_advertising_content_web_services"
  ),
  false,
  "generic marketing software and content-platform language must not activate the services playbook"
);

const artsProfile = profile({
  company_name: "Jammcard",
  summary: "A music community where artists create digital content, promote concerts, and find live performance work.",
  products_services: ["artist community", "live performance talent marketplace"],
  industries: ["music", "creative economy"],
  keywords: ["music", "artist", "concert", "live performance"]
});
const artsMatches = matchPlaybooks(artsProfile);
assert.equal(artsMatches[0]?.playbook_id, "music_arts_creative_economy");
assert.equal(
  artsMatches.some((playbook) => playbook.playbook_id === "marketing_advertising_content_web_services"),
  false,
  "arts and generic digital-content language must not activate the services playbook"
);

const artsWithStrayMarketingLane = applyPlaybooksToProfile({
  ...artsProfile,
  opportunity_lanes: [
    "City and county live performance budgets",
    "Government marketing, communications, and public outreach procurement"
  ],
  lane_search_terms: {
    "City and county live performance budgets": ["live music performance"],
    "Government marketing, communications, and public outreach procurement": ["government marketing services"]
  }
});
assert.equal(
  artsWithStrayMarketingLane.opportunity_lanes.includes(
    "Government marketing, communications, and public outreach procurement"
  ),
  false
);

const reparelMatches = matchPlaybooks(
  profile({
    company_name: "Reparel",
    summary: "Medical compression braces and rehabilitation supplies for recovery.",
    products_services: ["orthotic supplies", "rehabilitation supplies"],
    industries: ["healthcare", "medical"]
  })
);
assert.equal(reparelMatches[0]?.playbook_id, "healthcare_rehab_dme");

const schoolGigMatches = matchPlaybooks(
  profile({
    company_name: "SchoolGig",
    summary: "Teacher recruitment and school staffing platform for school districts.",
    products_services: ["teacher hiring platform"],
    industries: ["education workforce"]
  })
);
assert.equal(schoolGigMatches[0]?.playbook_id, "education_workforce_training");
assert.equal(
  schoolGigMatches.some((playbook) => playbook.playbook_id === "marketing_advertising_content_web_services"),
  false
);

console.log("PASS marketing playbook: focused matching, enrichment, isolation, and 3 regression companies");
