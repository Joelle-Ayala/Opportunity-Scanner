import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compareStoredOpportunitySignals } from "../lib/monitoring/comparison.ts";

const comparisonDate = new Date("2026-07-27T12:00:00.000Z");

function signal(overrides = {}) {
  return {
    id: "signal-1",
    created_at: "2026-07-26T12:00:00.000Z",
    opportunity_title: "Public arts spending",
    record_class: "evidence",
    current_validated_at: null,
    award_year: 2022,
    period_end: "2024-09-30",
    source_type: "historical_award",
    source_name: "USAspending",
    source_url: "https://example.gov/award/1",
    agency_or_funder: "Example Agency",
    deadline: "2024-09-30",
    geography: "National",
    external_evidence_summary: "Historical award evidence.",
    why_it_matters: "Shows funded demand.",
    who_benefits: "Public-sector sellers",
    likely_buyer_or_partner: "Example Agency",
    revenue_pathway: "sell_to_agency",
    relevance_score: 90,
    novelty_score: 80,
    confidence_score: 90,
    reasoning: [],
    recommended_action: "Research the funded buyer",
    actionability: "maybe",
    actionability_reason: "Historical evidence.",
    best_next_step: "Map the buyer.",
    human_review_required: false,
    query_used: "arts",
    raw_json: {},
    show_in_report: true,
    ...overrides
  };
}

test("evidence records never become expired and compare evidence dates by their real labels", () => {
  const previous = signal({ award_year: 2021, period_end: "2023-09-30" });
  const current = signal();
  const comparison = compareStoredOpportunitySignals([previous], [current], comparisonDate);

  assert.equal(comparison.current[0].status, "changed");
  assert.equal(comparison.summary.expiredCurrent, 0);
  assert.deepEqual(
    comparison.current[0].changes.map(({ field, label }) => ({ field, label })),
    [
      { field: "award_year", label: "Award year" },
      { field: "period_end", label: "Period of performance end" }
    ]
  );
});

test("only explicit current records can become expired", () => {
  const current = signal({
    record_class: "current",
    current_validated_at: "2026-07-26T12:00:00.000Z",
    award_year: null,
    period_end: null,
    source_type: "active_contract",
    deadline: "2026-07-26"
  });
  const comparison = compareStoredOpportunitySignals([], [current], comparisonDate);

  assert.equal(comparison.current[0].status, "expired");
  assert.equal(comparison.summary.expiredCurrent, 1);
});

test("comparison and pursuit UI use record-class-aware date language", async () => {
  const [comparisonView, workspace, pursuitList] = await Promise.all([
    readFile(new URL("../components/comparison/report-comparison-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/pursuit-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/dashboard/pursuit-list.tsx", import.meta.url), "utf8")
  ]);

  assert.match(comparisonView, /opportunity\.recordClass === "evidence"/);
  assert.match(comparisonView, /opportunity\.status === "expired"/);
  assert.match(comparisonView, /status: "changed" as const/);
  assert.match(comparisonView, /label: "Award year"/);
  assert.match(comparisonView, /label: "Period of performance end"/);
  assert.match(comparisonView, />Record date</);
  assert.match(comparisonView, /Expired live opportunities/);

  assert.match(workspace, />\s*Internal due date\s*</);
  assert.doesNotMatch(workspace, />\s*Deadline\s*</);
  assert.match(pursuitList, />Internal due date</);
  assert.match(pursuitList, /No internal due date/);
  assert.doesNotMatch(pursuitList, />Next deadline</);
});
