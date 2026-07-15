import assert from "node:assert/strict";
import test from "node:test";
import { generateCompanyProfile, profileGenerationInput } from "../lib/profile.ts";
import { evaluateReportQuality } from "../lib/reportQuality.ts";
import type { CompanyProfile, NormalizedOpportunityAction, OpportunitySignal } from "../lib/types.ts";

function profile(companyName: string, services: string[], playbookId: string): CompanyProfile {
  return {
    company_name: companyName,
    website: `https://${companyName.toLowerCase()}.example`,
    summary: services.join(" "),
    products_services: services,
    inferred_products_services: services,
    target_customers: [],
    inferred_target_customers: [],
    industries: services,
    geographies: ["United States"],
    keywords: services,
    inferred_public_sector_lanes: [],
    inferred_buyer_partner_types: [],
    inferred_revenue_motions: [],
    public_sector_search_terms: services,
    translated_public_sector_terms: [],
    negative_keywords: [],
    possible_naics: [],
    possible_psc: [],
    possible_soc: [],
    policy_sensitive_categories: [],
    opportunity_lanes: services,
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

function action(target: string, motion = "sell_to_agency"): NormalizedOpportunityAction {
  return {
    estimated_opportunity_type: "active_opportunity",
    buyer_partner_type: "agency",
    revenue_motion: motion,
    target_organization: target,
    source_status: "Open",
    source_deadline: "2026-12-31",
    source_published_date: "2026-07-01",
    time_sensitivity: "active",
    pursuit_difficulty: "medium",
    actionability_score: 84,
    actionability_label: "Strong",
    show_in_report: true,
    screening_path: "Clear revenue path",
    screening_reason: "The source supports a current route.",
    next_best_action: `Review the source instructions and contact the program owner at ${target}.`,
    contact_strategy: "contact_program_office",
    recommended_contact_roles: ["Program Director"],
    source_native_contact_available: false,
    manual_research_instruction: `Verify the program owner at ${target}.`,
    workflow_payload_ready: true,
    workflow_payload_reason: "Ready for workflow.",
    crm_note: `Source-backed opportunity for ${target}.`,
    outreach_angle: "Lead with the relevant source-backed capability.",
    follow_up_task: `Contact the program owner at ${target}.`
  };
}

function opportunity(input: {
  title: string;
  evidence: string;
  target: string;
  sourceUrl: string;
  motion?: string;
}): OpportunitySignal {
  return {
    opportunity_title: input.title,
    source_type: "active_contract",
    source_name: "Official procurement portal",
    source_url: input.sourceUrl,
    agency_or_funder: input.target,
    deadline: "2026-12-31",
    geography: "United States",
    external_evidence_summary: input.evidence,
    why_it_matters: "The source shows a defined public-sector purchasing route.",
    who_benefits: input.target,
    likely_buyer_or_partner: input.target,
    revenue_pathway: "sell_to_agency",
    relevance_score: 90,
    novelty_score: 80,
    confidence_score: 90,
    reasoning: ["Source-backed fit"],
    recommended_action: "Review the official record and route to the program owner.",
    actionability: "yes",
    actionability_reason: "Current source and clear target.",
    best_next_step: "Review the official record.",
    human_review_required: false,
    query_used: "intentionally excluded from evidence matching",
    raw_json: {},
    normalized_action: action(input.target, input.motion)
  };
}

const reparel = profile(
  "Reparel",
  ["medical recovery sleeves", "durable medical equipment", "orthotic rehabilitation supplies"],
  "healthcare_rehab_dme"
);
const schoolGig = profile(
  "SchoolGig",
  ["teacher hiring", "school district recruiting", "applicant tracking"],
  "education_workforce_training"
);
const jammcard = profile(
  "Jammcard",
  ["live music", "artist booking", "public concert entertainment"],
  "music_arts_creative_economy"
);

test("company profile generation excludes customer identity and acquisition data", () => {
  const safeInput = profileGenerationInput({
    companyUrl: "https://example.com",
    companyName: "Example",
    email: "private@example.com",
    reportType: "deep",
    opportunityFocus: "Find public school district buyers for our recruiting platform.",
    firstTouchAttribution: {
      id: "private-attribution-id",
      occurredAt: "2026-07-15T12:00:00.000Z",
      landingPath: "/",
      referrerHost: "private-referrer.example"
    },
    utmSource: "private-campaign"
  });

  assert.equal(safeInput.companyUrl, "https://example.com");
  assert.equal(safeInput.opportunityFocus, "Find public school district buyers for our recruiting platform.");
  assert.equal("email" in safeInput, false);
  assert.equal("firstTouchAttribution" in safeInput, false);
  assert.equal("utmSource" in safeInput, false);
  assert.equal("reportType" in safeInput, false);
});

test("Reparel paid/full report passes with source-backed medical supply opportunities", () => {
  const result = evaluateReportQuality(reparel, [
    opportunity({ title: "VA recovery sleeve supply", evidence: "The VA seeks medical recovery sleeves for rehabilitation clinics.", target: "Department of Veterans Affairs", sourceUrl: "https://sam.gov/opp/reparel-1/view" }),
    opportunity({ title: "County orthotic supply contract", evidence: "County clinics need orthotic rehabilitation supplies for patient care.", target: "Orange County Health Care Agency", sourceUrl: "https://procurement.oc.gov/bids/reparel-2" }),
    opportunity({ title: "DME purchasing schedule", evidence: "The purchasing schedule covers durable medical equipment and rehabilitation products.", target: "New York State Office of General Services", sourceUrl: "https://ogs.ny.gov/contracts/reparel-3" })
  ], "full");

  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
  assert.equal(result.metrics.qualifyingOpportunityCount, 3);
});

test("SchoolGig paid/full report passes with district workforce opportunities", () => {
  const result = evaluateReportQuality(schoolGig, [
    opportunity({ title: "Teacher hiring platform RFP", evidence: "The district requests a teacher hiring and applicant tracking platform.", target: "Austin Independent School District", sourceUrl: "https://www.austinisd.org/procurement/rfp-101" }),
    opportunity({ title: "District recruiting services", evidence: "School district recruiting services are needed for hard-to-fill educator roles.", target: "Clark County School District", sourceUrl: "https://ccsd.net/procurement/bid-202" }),
    opportunity({ title: "Educator applicant tracking", evidence: "The education agency seeks applicant tracking for teacher recruitment.", target: "California Department of Education", sourceUrl: "https://www.cde.ca.gov/contracts/303" })
  ], "full");

  assert.equal(result.passed, true);
  assert.equal(result.metrics.tier, "full");
  assert.equal(result.blockingReasons.length, 0);
});

test("Jammcard paid/full report passes with live music buyer opportunities", () => {
  const result = evaluateReportQuality(jammcard, [
    opportunity({ title: "Summer concert artist booking", evidence: "The city needs live music and artist booking for its summer concert series.", target: "City of Chicago Department of Cultural Affairs", sourceUrl: "https://www.chicago.gov/procurement/music-1" }),
    opportunity({ title: "Public concert entertainment", evidence: "The parks department is buying public concert entertainment and live music programming.", target: "Los Angeles County Department of Parks and Recreation", sourceUrl: "https://parks.lacounty.gov/contracts/music-2" }),
    opportunity({ title: "Festival musician services", evidence: "The tourism office seeks musician services and artist booking for a public festival.", target: "Visit Seattle", sourceUrl: "https://visitseattle.org/vendor/music-3" })
  ], "full");

  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
});

test("preview/free and paid/full tiers enforce different minimum counts", () => {
  const opportunities = [
    opportunity({ title: "District teacher recruiting A", evidence: "School district recruiting for teacher hiring.", target: "Denver Public Schools", sourceUrl: "https://dpsk12.org/procurement/a" }),
    opportunity({ title: "District teacher recruiting B", evidence: "Teacher hiring and applicant tracking for district schools.", target: "Boston Public Schools", sourceUrl: "https://bostonpublicschools.org/procurement/b" })
  ];

  assert.equal(evaluateReportQuality(schoolGig, opportunities, "preview").passed, true);
  const full = evaluateReportQuality(schoolGig, opportunities, "full");
  assert.equal(full.passed, false);
  assert.equal(full.metrics.minimumOpportunityCount, 3);
  assert.ok(full.blockingReasons.some((reason) => reason.code === "INSUFFICIENT_OPPORTUNITIES"));
});

test("irrelevant source evidence fails even when generated query text claims a match", () => {
  const irrelevant = opportunity({
    title: "Quantum computing research award",
    evidence: "The laboratory is researching qubits, cryptography, and quantum networking.",
    target: "National Science Foundation",
    sourceUrl: "https://nsf.gov/award/quantum-1"
  });
  irrelevant.query_used = "live music artist booking public concert entertainment";
  irrelevant.raw_json = { generated_query: "live music artist booking public concert entertainment" };
  irrelevant.why_it_matters = "This could matter to live music and artist booking providers.";

  const result = evaluateReportQuality(jammcard, [irrelevant, { ...irrelevant, opportunity_title: "Quantum computing research award two", source_url: "https://nsf.gov/award/quantum-2", normalized_action: action("Department of Energy") }], "preview");
  assert.equal(result.passed, false);
  assert.equal(result.metrics.requirementPassCounts.companyCorrectEvidence, 0);
  assert.ok(result.blockingReasons.some((reason) => reason.code === "COMPANY_EVIDENCE_MISSING"));
});

test("a generated title cannot manufacture company fit when the source record is irrelevant", () => {
  const misleading = opportunity({
    title: "Live music and artist booking opportunity",
    evidence: "The laboratory is researching qubits, cryptography, and quantum networking.",
    target: "National Science Foundation",
    sourceUrl: "https://nsf.gov/award/quantum-title"
  });

  const result = evaluateReportQuality(jammcard, [
    misleading,
    {
      ...misleading,
      opportunity_title: "Public concert entertainment opportunity",
      source_url: "https://nsf.gov/award/quantum-title-two",
      normalized_action: action("Department of Energy")
    }
  ], "preview");

  assert.equal(result.passed, false);
  assert.equal(result.metrics.requirementPassCounts.companyCorrectEvidence, 0);
  assert.ok(result.blockingReasons.some((reason) => reason.code === "COMPANY_EVIDENCE_MISSING"));
});

test("insufficient reports and malformed action rows return stable blockers and metrics", () => {
  const invalid = opportunity({
    title: "District teacher hiring record",
    evidence: "The school district needs teacher hiring support.",
    target: "Eligible applicants or future award recipients",
    sourceUrl: "javascript:alert(1)",
    motion: "make money somehow"
  });
  invalid.external_evidence_summary = "<p>The school district needs teacher hiring support.</p>";
  invalid.normalized_action = {
    ...invalid.normalized_action!,
    show_in_report: false,
    actionability_label: "Screened out",
    next_best_action: "Review",
    contact_strategy: undefined as never
  };

  const result = evaluateReportQuality(schoolGig, [invalid], "preview");
  const codes = new Set(result.blockingReasons.map((reason) => reason.code));
  assert.equal(result.passed, false);
  assert.ok(result.score < 100);
  assert.ok(codes.has("INSUFFICIENT_OPPORTUNITIES"));
  assert.ok(codes.has("INVALID_SOURCE_URL"));
  assert.ok(codes.has("TARGET_ORGANIZATION_MISSING"));
  assert.ok(codes.has("REVENUE_MOTION_MISSING"));
  assert.ok(codes.has("NEXT_ACTION_OR_CONTACT_PATH_MISSING"));
  assert.ok(codes.has("ACTIONABILITY_MISSING"));
  assert.ok(codes.has("HTML_LEAKAGE"));
});

test("duplicate title and target pairs block otherwise valid reports", () => {
  const first = opportunity({ title: "Teacher recruiting platform", evidence: "Teacher hiring and school district recruiting platform.", target: "Miami-Dade County Public Schools", sourceUrl: "https://dadeschools.net/procurement/one" });
  const duplicate = { ...first, source_url: "https://dadeschools.net/procurement/two", normalized_action: { ...first.normalized_action! } };
  const result = evaluateReportQuality(schoolGig, [first, duplicate], "preview");

  assert.equal(result.passed, false);
  assert.equal(result.metrics.requirementPassCounts.uniqueOpportunity, 0);
  assert.ok(result.blockingReasons.some((reason) => reason.code === "DUPLICATE_OPPORTUNITY"));
});

test("low-confidence company profiles are held even when rows otherwise look complete", () => {
  const uncertainProfile = {
    ...schoolGig,
    profile_confidence_score: 40
  };
  const opportunities = [
    opportunity({ title: "Teacher recruiting one", evidence: "Teacher hiring for a school district recruiting program.", target: "District One", sourceUrl: "https://example.gov/one" }),
    opportunity({ title: "Teacher recruiting two", evidence: "Teacher hiring for a school district recruiting program.", target: "District Two", sourceUrl: "https://example.gov/two" }),
    opportunity({ title: "Teacher recruiting three", evidence: "Teacher hiring for a school district recruiting program.", target: "District Three", sourceUrl: "https://example.gov/three" })
  ];

  const result = evaluateReportQuality(uncertainProfile, opportunities, "full");
  assert.equal(result.passed, false);
  assert.ok(result.blockingReasons.some((reason) => reason.code === "PROFILE_CONFIDENCE_LOW"));
});

test("keyword-only fallback profiles are held for review", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const fallback = await generateCompanyProfile(
      {
        companyUrl: "https://example.com",
        opportunityFocus: "We sell educator recruiting software to public school districts."
      },
      "Example builds recruiting and applicant tracking software for education employers."
    );
    assert.equal(fallback.profile_confidence_score, 35);
    assert.match(fallback.profile_assumptions_summary ?? "", /AI profile step was unavailable/i);
  } finally {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  }
});

test("evaluation is deterministic for the same runtime inputs", () => {
  const opportunities = [
    opportunity({ title: "VA orthotic supply A", evidence: "VA clinics need orthotic rehabilitation supplies.", target: "VA New York Harbor Healthcare System", sourceUrl: "https://va.gov/procurement/orthotic-a" }),
    opportunity({ title: "VA recovery sleeve supply B", evidence: "Medical recovery sleeves are requested for rehabilitation care.", target: "VA Boston Healthcare System", sourceUrl: "https://va.gov/procurement/sleeve-b" })
  ];

  assert.deepEqual(
    evaluateReportQuality(reparel, opportunities, "preview"),
    evaluateReportQuality(reparel, opportunities, "preview")
  );
});
