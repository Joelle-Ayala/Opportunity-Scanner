import assert from "node:assert/strict";
import test from "node:test";

import {
  prioritizeOpportunityRecords,
  scanFocusPrefersCurrentOpportunities
} from "../lib/scanPipeline.ts";
import type { OpportunitySignal, ScanInput } from "../lib/types.ts";

const baseInput: ScanInput = {
  companyUrl: "https://example.com",
  reportType: "deep"
};

function signal(
  title: string,
  input: Partial<OpportunitySignal>
): OpportunitySignal {
  return {
    opportunity_title: title,
    source_type: "historical_award",
    source_name: "USAspending.gov",
    source_url: "https://www.usaspending.gov",
    agency_or_funder: "Agency",
    deadline: "",
    geography: "Federal",
    external_evidence_summary: "Source-backed evidence",
    why_it_matters: "Evidence of demand",
    who_benefits: "Example",
    likely_buyer_or_partner: "Example buyer",
    revenue_pathway: "sell_to_grantee",
    relevance_score: 80,
    novelty_score: 70,
    confidence_score: 80,
    reasoning: [],
    recommended_action: "Research",
    actionability: "maybe",
    actionability_reason: "Needs validation",
    best_next_step: "Validate",
    human_review_required: false,
    query_used: "example",
    raw_json: {},
    ...input
  };
}

test("detects an explicit current or actionable scan focus", () => {
  assert.equal(
    scanFocusPrefersCurrentOpportunities({
      ...baseInput,
      opportunityFocus: "Current actionable solicitations we can apply for"
    }),
    true
  );
  assert.equal(scanFocusPrefersCurrentOpportunities(baseInput), false);
});

test("prioritizes verified-current records without dropping evidence", () => {
  const evidence = signal("Historical buyer", {
    record_class: "evidence",
    relevance_score: 99
  });
  const current = signal("Live solicitation", {
    record_class: "current",
    source_type: "active_contract",
    source_name: "SAM.gov",
    deadline: "2026-08-20",
    current_validated_at: "2026-07-27T12:00:00.000Z",
    relevance_score: 70
  });

  const ranked = prioritizeOpportunityRecords(
    [evidence, current],
    { ...baseInput, opportunityFocus: "active opportunities" },
    new Date("2026-07-27T12:00:00Z")
  );

  assert.deepEqual(
    ranked.map((item) => item.opportunity_title),
    ["Live solicitation", "Historical buyer"]
  );
});
