export type SourceStatus = "Active" | "Available" | "Needs API key" | "Planned" | "Checked";

export type SourceCatalogItem = {
  id: string;
  name: string;
  status: SourceStatus;
  key: string;
  value: string;
  next: string;
  resultWhenMissing?: string;
};

export function sourceCatalog({ samGovConfigured }: { samGovConfigured: boolean }): SourceCatalogItem[] {
  return [
    {
      id: "company_website",
      name: "Company website",
      status: "Active",
      key: "None",
      value: "Builds the company profile and search strategy.",
      next: "Keep improving profile extraction and logo detection."
    },
    {
      id: "usaspending.gov",
      name: "USAspending.gov",
      status: "Active",
      key: "None",
      value: "Finds historical awards, funded buyers, and money-flow patterns.",
      next: "Keep using as market-map evidence and prior buying patterns."
    },
    {
      id: "federal_register",
      name: "Federal Register",
      status: "Active",
      key: "None",
      value: "Finds policy and regulatory demand signals.",
      next: "Pair policy results with buyer, grant, or procurement paths before surfacing as actionable."
    },
    {
      id: "sam.gov",
      name: "SAM.gov",
      status: samGovConfigured ? "Active" : "Needs API key",
      key: "SAM_API_KEY",
      value: "Finds active solicitations, sources sought, special notices, and award notices.",
      next: "Add API key, then test Jammcard, SchoolGig, and Reparel before broadening terms.",
      resultWhenMissing: "Add SAM_API_KEY to query active opportunities"
    },
    {
      id: "grants.gov",
      name: "Grants.gov",
      status: "Active",
      key: "None",
      value: "Finds active and forecasted grant/funding opportunities plus source-listed grant program contacts.",
      next: "Use grant contacts for eligibility/program questions; identify grantees or eligible applicants for sales outreach."
    },
    {
      id: "state_local",
      name: "State/local portals",
      status: "Planned",
      key: "Varies",
      value: "Models city, county, state, school, arts, parks, tourism, and procurement portal routes for follow-up research.",
      next: "Activate deeper scrapers/API integrations after repeatable high-value portals are validated."
    },
    {
      id: "snov",
      name: "Snov contact enrichment",
      status: "Active",
      key: "SNOV_CLIENT_ID / SNOV_CLIENT_SECRET",
      value: "Finds role-aligned contact candidates after a buyer or recipient domain is verified.",
      next: "Add buyer-domain resolution before spending Snov lookup credits."
    },
    {
      id: "contact_providers",
      name: "Apollo / Prospeo / People Data Labs / Hunter",
      status: "Available",
      key: "APOLLO_API_KEY / PROSPEO_API_KEY / PEOPLE_DATA_LABS_API_KEY / HUNTER_API_KEY",
      value: "Adds additional contact discovery, email verification, and person/company enrichment options.",
      next: "Use after role targeting and domain resolution so enrichment returns decision-makers, not random contacts."
    },
    {
      id: "clay",
      name: "Clay enrichment orchestration",
      status: process.env.CLAY_CONTACT_WORKFLOW_URL || process.env.CLAY_CONTACT_ENRICHMENT_WEBHOOK_URL ? "Active" : "Available",
      key: "CLAY_API_KEY / CLAY_CONTACT_WORKFLOW_URL",
      value: "Runs capped contact workflow enrichment for paid outreach packages after the opportunity list is qualified.",
      next: "Configure the Clay contact workflow URL in production to enrich named contacts before falling back to Snov."
    }
  ];
}
