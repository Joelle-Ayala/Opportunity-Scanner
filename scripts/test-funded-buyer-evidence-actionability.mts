import assert from "node:assert/strict";
import test from "node:test";

import { assessActionability } from "../lib/actionability.ts";
import { classifyOpportunity } from "../lib/opportunityClassification.ts";
import type { CompanyProfile, StoredOpportunitySignal } from "../lib/types.ts";

function profile(
  companyName: string,
  website: string,
  services: string[],
  playbookId: string
): CompanyProfile {
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

function evidenceSignal(overrides: Partial<StoredOpportunitySignal>): StoredOpportunitySignal {
  return {
    id: "evidence-1",
    created_at: "2026-07-27T12:00:00.000Z",
    opportunity_title: "Named recipient received a public award",
    record_class: "evidence",
    current_validated_at: null,
    award_year: 2022,
    period_end: "2023-03-17",
    source_type: "historical_award",
    source_name: "USAspending.gov",
    source_url: "https://www.usaspending.gov/award/example",
    agency_or_funder: "Department of Education",
    deadline: "2023-03-17",
    geography: "United States",
    external_evidence_summary: "Historical public award.",
    why_it_matters: "This is funded-buyer evidence for a directly relevant lane.",
    who_benefits: "Public-sector sellers",
    likely_buyer_or_partner: "Named Recipient, Inc.",
    revenue_pathway: "partner_with_recipient",
    relevance_score: 88,
    novelty_score: 76,
    confidence_score: 76,
    reasoning: ["Inferred lane: K-12 hiring, teacher staffing, and educator workforce"],
    recommended_action: "Research the award recipient.",
    actionability: "maybe",
    actionability_reason: "Historical funded-buyer evidence.",
    best_next_step: "Research the recipient.",
    human_review_required: true,
    query_used: "school staffing",
    raw_json: {
      "End Date": "2023-03-17",
      "Recipient Name": "Named Recipient, Inc."
    },
    ...overrides
  };
}

const schoolGig = profile(
  "SchoolGig",
  "https://schoolgig.us",
  ["teacher hiring platform", "school district recruiting", "applicant tracking"],
  "education_workforce_training"
);

const jammcard = profile(
  "Jammcard",
  "https://jammcard.com",
  ["live music", "artist booking", "musician services"],
  "music_arts_creative_economy"
);

test("SchoolGig promotes credible recipient-backed workforce evidence without deadline semantics", () => {
  const result = classifyOpportunity(
    evidenceSignal({
      opportunity_title:
        "WESTAT, INC. received $9,954,119: K-12 hiring, teacher staffing, and educator workforce",
      external_evidence_summary:
        "Schools and Staffing Survey, Teacher Follow-up Survey, school staffing, and teacher attrition research.",
      likely_buyer_or_partner: "WESTAT, INC.",
      raw_json: {
        "End Date": "2014-09-30",
        "Recipient Name": "WESTAT, INC."
      },
      deadline: "2014-09-30",
      period_end: "2014-09-30",
      award_year: 2011
    }),
    schoolGig
  );

  assert.equal(result.show_in_report, true);
  assert.equal(result.estimated_opportunity_type, "historical_market_evidence");
  assert.equal(result.source_status, "Funded-buyer evidence");
  assert.equal(result.source_deadline, "");
  assert.equal(result.time_sensitivity, "evergreen");
  assert.notEqual(result.actionability_label, "Screened out");
  assert.doesNotMatch(`${result.screening_path} ${result.screening_reason}`, /expired|ended on|deadline/i);
});

test("Jammcard promotes source-backed cultural-programming evidence using its synthesized lane", () => {
  const result = classifyOpportunity(
    evidenceSignal({
      opportunity_title:
        "HARGROVE, LLC received $9,267,988: Cultural programming, live events, and public arts buyers",
      agency_or_funder: "Department of State",
      external_evidence_summary:
        "2022 Summit of the Americas technical and event production services.",
      likely_buyer_or_partner: "HARGROVE, LLC",
      relevance_score: 64,
      query_used: "event production services",
      reasoning: [
        "Inferred lane: Cultural programming, live events, and public arts buyers"
      ],
      raw_json: {
        "End Date": "2023-03-17",
        "Recipient Name": "HARGROVE, LLC"
      }
    }),
    jammcard
  );

  assert.equal(result.show_in_report, true);
  assert.equal(result.estimated_opportunity_type, "historical_market_evidence");
  assert.equal(result.source_deadline, "");
  assert.match(result.screening_reason, /historical funded-buyer evidence/i);
});

test("an irrelevant past SAM row cannot pass from a creative query or synthesized lane", () => {
  const result = classifyOpportunity(
    evidenceSignal({
      opportunity_title: "Arts and cultural programming support",
      source_type: "active_contract",
      source_name: "SAM.gov",
      source_url: "https://sam.gov/opp/example",
      external_evidence_summary:
        "Enterprise network engineering, cybersecurity operations, and software maintenance.",
      likely_buyer_or_partner: "Example Systems Integrator",
      revenue_pathway: "procurement_bid",
      query_used: "live music services",
      reasoning: [
        "Inferred lane: Cultural programming, live events, and public arts buyers"
      ],
      raw_json: {
        "End Date": "2024-08-01",
        "Recipient Name": "Example Systems Integrator"
      },
      deadline: "2024-08-01",
      period_end: "2024-08-01"
    }),
    jammcard
  );

  assert.equal(result.show_in_report, false);
  assert.equal(result.source_deadline, "");
  assert.match(result.screening_path, /not a live-music revenue fit/i);
});

test("evidence without a concrete recipient remains screened even in a direct lane", () => {
  const signal = evidenceSignal({
    likely_buyer_or_partner: "Public agency",
    raw_json: {
      "End Date": "2023-03-17",
      "Recipient Name": "DOMESTIC AWARDEES (UNDISCLOSED)"
    }
  });
  const actionability = assessActionability(signal);
  const result = classifyOpportunity(signal, schoolGig);

  assert.equal(actionability.actionability, "unlikely");
  assert.match(actionability.reason, /does not identify a concrete recipient/i);
  assert.equal(result.show_in_report, false);
  assert.equal(result.source_deadline, "");
});

test("generic arts and education awards remain screened without a staffing or direct creative-delivery path", () => {
  const genericArts = classifyOpportunity(
    evidenceSignal({
      opportunity_title: "Regional arts education award",
      external_evidence_summary:
        "A museum exhibition introduces students to regional visual arts history.",
      likely_buyer_or_partner: "Regional History Museum",
      query_used: "public arts program",
      reasoning: ["Inferred lane: Arts and culture grants"],
      relevance_score: 82,
      raw_json: {
        "End Date": "2022-09-30",
        "Recipient Name": "Regional History Museum"
      }
    }),
    jammcard
  );
  const genericEducation = classifyOpportunity(
    evidenceSignal({
      opportunity_title: "Student literacy improvement award",
      external_evidence_summary:
        "A school literacy program supports reading instruction and student achievement.",
      likely_buyer_or_partner: "Regional Literacy Foundation",
      query_used: "education workforce",
      reasoning: [
        "Inferred lane: K-12 hiring, teacher staffing, and educator workforce"
      ],
      raw_json: {
        "End Date": "2022-09-30",
        "Recipient Name": "Regional Literacy Foundation"
      }
    }),
    schoolGig
  );

  assert.equal(genericArts.show_in_report, false);
  assert.equal(genericEducation.show_in_report, false);
  assert.equal(genericArts.source_deadline, "");
  assert.equal(genericEducation.source_deadline, "");
});
