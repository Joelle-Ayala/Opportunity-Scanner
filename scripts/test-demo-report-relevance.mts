import assert from "node:assert/strict";
import test from "node:test";
import { classifyOpportunity } from "../lib/opportunityClassification.ts";
import { normalizeOpportunityAction, opportunityActionFor } from "../lib/opportunityAction.ts";
import type { CompanyProfile, StoredOpportunitySignal } from "../lib/types.ts";

function profile(companyName: string, website: string, services: string[], playbookId: string): CompanyProfile {
  return {
    company_name: companyName,
    website,
    summary: services.join(" "),
    products_services: services,
    inferred_products_services: services,
    target_customers: [],
    industries: [],
    geographies: [],
    keywords: services,
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
    selected_playbooks: [{
      playbook_id: playbookId,
      name: playbookId,
      match_score: 100,
      matched_terms: services,
      source_categories_to_activate: [],
      planned_source_categories: [],
      likely_revenue_motions: [],
      suggested_contact_roles: [],
      report_guidance: ""
    }],
    activated_source_categories: [],
    planned_source_categories: [],
    likely_revenue_motions: [],
    suggested_contact_roles: [],
    report_guidance: []
  };
}

function signal(title: string, evidence: string, query: string, lane: string): StoredOpportunitySignal {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    created_at: "2026-07-15T00:00:00.000Z",
    opportunity_title: title,
    source_type: "active_grant",
    source_name: "Grants.gov",
    source_url: "https://example.gov/source",
    agency_or_funder: "Public agency",
    deadline: "2099-12-31",
    geography: "United States",
    external_evidence_summary: evidence,
    why_it_matters: `Generated reasoning for ${query}`,
    who_benefits: "Public agency",
    likely_buyer_or_partner: "Public agency",
    revenue_pathway: "sell_to_grantee",
    relevance_score: 95,
    novelty_score: 90,
    confidence_score: 90,
    reasoning: [`Inferred lane: ${lane}`],
    recommended_action: "Review",
    actionability: "yes",
    actionability_reason: "High score",
    best_next_step: "Review",
    human_review_required: false,
    query_used: query,
    raw_json: {}
  };
}

const jammcard = profile("Jammcard", "https://jammcard.com", ["live music", "artist booking", "musician services"], "music_arts_creative_economy");
const reparel = profile("Reparel", "https://reparel.com", ["medical recovery sleeves", "DME", "orthotic products"], "healthcare_rehab_dme");
const schoolGig = profile("SchoolGig", "https://schoolgig.us", ["teacher hiring platform", "school district recruiting", "applicant tracking"], "education_workforce_training");

test("Jammcard rejects unrelated research even when the query and inferred lane say music", () => {
  const result = classifyOpportunity(
    signal("Quantum Research BAA", "Research and development for qubits and advanced quantum systems.", "live music services", "Live performance procurement"),
    jammcard
  );
  assert.equal(result.show_in_report, false);
});

test("Jammcard keeps source-native public concert opportunities", () => {
  const valid = signal("City summer concert series", "The parks department seeks live musicians and event entertainment for public concerts.", "live music services", "City live performance budgets");
  valid.source_type = "active_contract";
  valid.source_name = "City procurement portal";
  valid.revenue_pathway = "procurement_bid";
  const result = classifyOpportunity(valid, jammcard);
  assert.equal(result.show_in_report, true);
});

test("Reparel rejects unrelated grants even when the query and inferred lane say DME", () => {
  const result = classifyOpportunity(
    signal("Mandalay Small Grants Program", "Funding supports civil society and local community initiatives in Burma.", "durable medical equipment", "Medical and rehabilitation supply procurement"),
    reparel
  );
  assert.equal(result.show_in_report, false);
});

test("Reparel keeps DMEPOS and VA rehabilitation evidence", () => {
  const result = classifyOpportunity(
    signal("DMEPOS pricing and coding update", "The VA is reviewing durable medical equipment, orthotic and prosthetic supply purchasing.", "durable medical equipment", "VA, prosthetics, and orthotics purchasing"),
    reparel
  );
  assert.equal(result.show_in_report, true);
});

test("Reparel rejects DMEPOS software and administration infrastructure", () => {
  const infrastructure = signal("DMEPOS administration system", "Software maintenance and administrative data processing for DMEPOS claims.", "durable medical equipment", "DME, Medicare, and reimbursement infrastructure");
  infrastructure.source_type = "policy_signal";
  infrastructure.revenue_pathway = "monitor_policy";
  assert.equal(classifyOpportunity(infrastructure, reparel).show_in_report, false);
});

test("SchoolGig rejects senior-only arts programs despite a teaching-artist query", () => {
  const result = classifyOpportunity(
    signal("Prop 28 arts education opportunity", "Creative aging at a senior center provides arts enrichment for older adults, with occasional teachers and students volunteering.", "teaching artists", "Arts education and teaching artist staffing"),
    schoolGig
  );
  assert.equal(result.show_in_report, false);
});

test("SchoolGig keeps district teaching-artist and staffing opportunities", () => {
  const result = classifyOpportunity(
    signal("District arts staffing initiative", "A K-12 school district seeks teaching artists for expanded learning and arts education.", "teaching artists", "Arts education and teaching artist staffing"),
    schoolGig
  );
  assert.equal(result.show_in_report, true);
});

test("current profile rules override stale normalized actions", () => {
  const invalid = signal("Quantum Research BAA", "Research and development for qubits.", "live music services", "Live performance procurement");
  const valid = signal("City concert", "A city seeks live musicians for public concerts.", "live music services", "City live performance budgets");
  valid.source_type = "active_contract";
  valid.source_name = "City procurement portal";
  valid.revenue_pathway = "procurement_bid";
  invalid.normalized_action = normalizeOpportunityAction(valid, jammcard);
  assert.equal(invalid.normalized_action.show_in_report, true);
  assert.equal(opportunityActionFor(invalid, jammcard).show_in_report, false);
});

test("whole-term evidence matching does not treat partnership as arts", async () => {
  const { hasStrongEvidence } = await import("../lib/connectors/shared.ts");
  assert.equal(hasStrongEvidence("international research partnership for quantum systems"), false);
  assert.equal(hasStrongEvidence("public arts and live music programming"), true);
});
