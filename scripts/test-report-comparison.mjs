import assert from "node:assert/strict";
import test from "node:test";

import { compareStoredOpportunitySignals } from "../lib/monitoring/comparison.ts";

const COMPARISON_DATE = new Date("2026-07-12T12:00:00.000Z");

function signal(overrides = {}) {
  return {
    id: "signal-1",
    created_at: "2026-07-01T00:00:00.000Z",
    opportunity_title: "City arts services",
    source_type: "active_contract",
    source_name: "City procurement",
    source_url: "https://example.gov/opportunities/arts?id=7&view=full",
    agency_or_funder: "Example City",
    deadline: "2026-08-15",
    geography: "New York, NY",
    likely_buyer_or_partner: "Department of Cultural Affairs",
    revenue_pathway: "sell_to_agency",
    recommended_action: "Review the solicitation",
    source_status: "Open",
    show_in_report: true,
    ...overrides
  };
}

test("classifies new, changed, unchanged, and removed signals with stable summary counts", () => {
  const unchanged = signal();
  const changedBefore = signal({
    id: "changed-before",
    source_url: "https://example.gov/opportunities/music",
    deadline: "2026-08-01",
    recommended_action: "Read the notice"
  });
  const changedAfter = signal({
    id: "changed-after",
    source_url: "https://example.gov/opportunities/music",
    deadline: "2026-09-01",
    recommended_action: "Schedule a bid review"
  });
  const removed = signal({ id: "removed", source_url: "https://example.gov/opportunities/old" });
  const added = signal({ id: "new", source_url: "https://example.gov/opportunities/new" });

  const result = compareStoredOpportunitySignals(
    [removed, changedBefore, unchanged],
    [added, unchanged, changedAfter],
    COMPARISON_DATE
  );

  assert.deepEqual(result.current.map(({ status }) => status), ["unchanged", "changed", "new"]);
  assert.deepEqual(result.previous.map(({ status }) => status), ["removed"]);
  assert.deepEqual(result.summary, {
    current: 3,
    previous: 1,
    new: 1,
    changed: 1,
    unchanged: 1,
    removed: 1,
    expiredCurrent: 0,
    expiredRemoved: 0
  });
  assert.deepEqual(
    result.current[1].changes.map(({ field, before, after }) => ({ field, before, after })),
    [
      { field: "deadline", before: "2026-08-01", after: "2026-09-01" },
      { field: "recommended_action", before: "Read the notice", after: "Schedule a bid review" }
    ]
  );
});

test("uses monitoring URL normalization for identity and ignores equivalent URL formatting", () => {
  const previous = signal({ source_url: "HTTPS://EXAMPLE.GOV/opportunities/arts?view=full&id=7#details" });
  const current = signal({ id: "current", source_url: "https://example.gov/opportunities/arts?id=7&view=full" });
  const result = compareStoredOpportunitySignals([previous], [current], COMPARISON_DATE);

  assert.equal(result.current.length, 1);
  assert.equal(result.current[0].status, "unchanged");
  assert.deepEqual(result.current[0].changes, []);
});

test("filters hidden rows from both reports", () => {
  const hiddenPrevious = signal({ source_url: "https://example.gov/hidden-old", show_in_report: false });
  const hiddenCurrent = signal({ source_url: "https://example.gov/hidden-new", show_in_report: false });
  const result = compareStoredOpportunitySignals([hiddenPrevious], [hiddenCurrent], COMPARISON_DATE);

  assert.deepEqual(result.current, []);
  assert.deepEqual(result.previous, []);
  assert.equal(result.summary.current, 0);
  assert.equal(result.summary.previous, 0);
});

test("classifies parseably expired current and removed records separately", () => {
  const expiredCurrent = signal({ source_url: "https://example.gov/current-expired", deadline: "2026-07-11" });
  const expiredRemoved = signal({ source_url: "https://example.gov/removed-expired", deadline: "July 1, 2026" });
  const result = compareStoredOpportunitySignals([expiredRemoved], [expiredCurrent], COMPARISON_DATE);

  assert.equal(result.current[0].status, "expired");
  assert.equal(result.current[0].baseStatus, "new");
  assert.equal(result.previous[0].status, "expired");
  assert.equal(result.previous[0].baseStatus, "removed");
  assert.equal(result.summary.expiredCurrent, 1);
  assert.equal(result.summary.expiredRemoved, 1);
  assert.equal(result.summary.new, 0);
  assert.equal(result.summary.removed, 0);
});

test("never invents expiration for an unparseable deadline", () => {
  const current = signal({ deadline: "Rolling; confirm with agency" });
  const result = compareStoredOpportunitySignals([], [current], COMPARISON_DATE);

  assert.equal(result.current[0].status, "new");
  assert.equal(result.summary.expiredCurrent, 0);
});

test("deduplicates repeated monitoring keys and returns deterministic key order", () => {
  const duplicateA = signal({ id: "b", recommended_action: "Review B" });
  const duplicateB = signal({ id: "a", recommended_action: "Review A" });
  const first = compareStoredOpportunitySignals(
    [],
    [signal({ source_url: "https://example.gov/z" }), duplicateA, duplicateB, signal({ source_url: "https://example.gov/a" })],
    COMPARISON_DATE
  );
  const second = compareStoredOpportunitySignals(
    [],
    [duplicateB, signal({ source_url: "https://example.gov/a" }), duplicateA, signal({ source_url: "https://example.gov/z" })],
    COMPARISON_DATE
  );

  assert.equal(first.current.length, 3);
  assert.equal(new Set(first.current.map(({ key }) => key)).size, 3);
  assert.deepEqual(first.current.map(({ key }) => key), second.current.map(({ key }) => key));
  assert.deepEqual(first.current.map(({ signal: item }) => item.id), second.current.map(({ signal: item }) => item.id));
  assert.deepEqual(first.current.map(({ key }) => key), [...first.current.map(({ key }) => key)].sort());
});

test("ignores internal field changes but detects every customer-facing field", () => {
  const previous = signal({ confidence_score: 10 });
  const internalOnly = signal({ id: "new-id", confidence_score: 99 });
  assert.equal(
    compareStoredOpportunitySignals([previous], [internalOnly], COMPARISON_DATE).current[0].status,
    "unchanged"
  );

  const current = signal({
    opportunity_title: "County arts services",
    agency_or_funder: "Example County",
    deadline: "2026-09-30",
    geography: "Albany, NY",
    source_status: "Amended",
    source_type: "active_grant",
    revenue_pathway: "direct_apply",
    likely_buyer_or_partner: "County Arts Office",
    recommended_action: "Confirm eligibility",
    source_url: "https://example.gov/opportunities/arts?id=7&view=full&amended=1"
  });
  const changed = compareStoredOpportunitySignals([previous], [current], COMPARISON_DATE).current[0];

  // Unique source/title/agency identity preserves amendments even when the URL changes.
  const sameIdentity = compareStoredOpportunitySignals(
    [previous],
    [{ ...current, source_url: previous.source_url }],
    COMPARISON_DATE
  ).current[0];
  assert.deepEqual(sameIdentity.changes.map(({ field }) => field), [
    "title",
    "agency_or_funder",
    "deadline",
    "geography",
    "source_status",
    "source_type",
    "revenue_pathway",
    "likely_buyer_or_partner",
    "recommended_action"
  ]);
  assert.equal(changed.status, "changed");
  assert.deepEqual(changed.changes.map(({ field }) => field), [
    "title",
    "agency_or_funder",
    "deadline",
    "geography",
    "source_status",
    "source_type",
    "revenue_pathway",
    "likely_buyer_or_partner",
    "recommended_action",
    "source_url"
  ]);
});
