import assert from "node:assert/strict";
import test from "node:test";
import {
  appendWebsiteEvidenceContext,
  attachWebsiteEvidenceToProfile,
  buildWebsiteProfileEvidence
} from "../lib/companyProfileEvidence.ts";
import type { CompanyProfile, ScrapedPage } from "../lib/types.ts";

const pages: ScrapedPage[] = [
  {
    url: "https://example.com/",
    title: "Example",
    text: "Example builds workforce training software.",
    metadata: {
      source_url: "https://example.com/",
      meta_description: "Workforce training software for public education.",
      organizations: [
        {
          schema_type: "Corporation",
          name: "Example",
          legal_name: "Example Learning, Inc.",
          founding_date: "2020",
          industry: ["Education technology"],
          address: { locality: "Albany", region: "NY", country: "US" }
        }
      ],
      company_profile_urls: [
        { platform: "linkedin_company", url: "https://linkedin.com/company/example" }
      ]
    }
  }
];

const profile = {
  company_name: "Example",
  website: "https://example.com/",
  summary: "Training software.",
  products_services: ["workforce training software"],
  target_customers: ["school districts"],
  industries: ["Workforce development"],
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
  report_guidance: []
} satisfies CompanyProfile;

test("structured website evidence is bounded, sourced, and added to profile generation context", () => {
  const evidence = buildWebsiteProfileEvidence(pages, "2026-07-15T12:00:00.000Z");
  assert.equal(evidence.length, 2);
  assert.equal(evidence.every((item) => item.source_url === "https://example.com/"), true);
  assert.equal(evidence.some((item) => item.fields.includes("legal_name")), true);

  const context = appendWebsiteEvidenceContext("VISIBLE WEBSITE TEXT", evidence);
  assert.match(context, /VERIFIED FIRST-PARTY COMPANY METADATA/);
  assert.match(context, /Example Learning, Inc\./);
});

test("profile keeps inferred intent while attaching first-party identity provenance", () => {
  const evidence = buildWebsiteProfileEvidence(pages, "2026-07-15T12:00:00.000Z");
  const enriched = attachWebsiteEvidenceToProfile(
    profile,
    pages,
    "https://www.example.com/path",
    evidence,
    "2026-07-15T12:00:01.000Z"
  );

  assert.equal(enriched.profile_schema_version, 2);
  assert.equal(enriched.canonical_domain, "example.com");
  assert.equal(enriched.legal_name, "Example Learning, Inc.");
  assert.equal(enriched.founding_date, "2020");
  assert.deepEqual(enriched.products_services, ["workforce training software"]);
  assert.deepEqual(enriched.target_customers, ["school districts"]);
  assert.deepEqual(enriched.industries, ["Workforce development", "Education technology"]);
  assert.deepEqual(enriched.geographies, ["Albany", "NY", "US"]);
  assert.deepEqual(enriched.company_profile_urls, [
    { platform: "linkedin_company", url: "https://linkedin.com/company/example" }
  ]);
  assert.deepEqual(enriched.company_enrichment?.sources_used, ["company_website"]);
});

