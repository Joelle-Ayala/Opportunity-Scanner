import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifyOpportunityRecord,
  isVerifiedFutureCloseDate,
  parseOpportunityRecordDate
} from "../lib/opportunityRecordClassification.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");
const AS_OF = "2026-07-27";

test("parses only supported, real calendar dates", () => {
  assert.equal(parseOpportunityRecordDate("2026-08-15T17:00:00-04:00"), "2026-08-15");
  assert.equal(parseOpportunityRecordDate("8/5/2026 11:59 PM"), "2026-08-05");
  assert.equal(parseOpportunityRecordDate("2026-02-30"), null);
  assert.equal(parseOpportunityRecordDate("rolling"), null);
});

test("classifies a verified future close date as current", () => {
  assert.deepEqual(
    classifyOpportunityRecord({
      sourceName: "SAM.gov",
      sourceType: "active_contract",
      deadline: "2026-08-15T17:00:00-04:00",
      currentValidatedAt: "2026-07-27T12:00:00.000Z"
    }, AS_OF),
    {
      recordClass: "current",
      currentValidatedAt: "2026-07-27T12:00:00.000Z",
      closeDate: "2026-08-15",
      deadline: "2026-08-15T17:00:00-04:00",
      awardYear: null,
      periodEnd: null
    }
  );
  assert.equal(isVerifiedFutureCloseDate("2026-08-15", AS_OF), true);
  assert.equal(isVerifiedFutureCloseDate(AS_OF, AS_OF), false);
});

test("demotes stale and unverifiable dates to evidence without deadline semantics", () => {
  assert.deepEqual(
    classifyOpportunityRecord({
      recordClass: "current",
      deadline: "2024-09-30",
      awardYear: 2024
    }, AS_OF),
    {
      recordClass: "evidence",
      currentValidatedAt: null,
      closeDate: null,
      deadline: null,
      awardYear: 2024,
      periodEnd: "2024-09-30"
    }
  );
  assert.equal(
    classifyOpportunityRecord({ deadline: "rolling; confirm with agency" }, AS_OF).recordClass,
    "evidence"
  );
  assert.equal(
    classifyOpportunityRecord({
      sourceName: "SAM.gov",
      sourceType: "active_contract",
      deadline: "2026-08-15",
      currentValidatedAt: "2026-07-10T12:00:00.000Z"
    }, AS_OF).recordClass,
    "evidence"
  );
});

test("keeps historical award dates as evidence even when period end is in the future", () => {
  assert.deepEqual(
    classifyOpportunityRecord({
      recordClass: "evidence",
      sourceName: "USAspending.gov",
      sourceType: "historical_award",
      deadline: "2027-06-30",
      awardYear: 2024
    }, AS_OF),
    {
      recordClass: "evidence",
      currentValidatedAt: null,
      closeDate: null,
      deadline: null,
      awardYear: 2024,
      periodEnd: "2027-06-30"
    }
  );
});

test("migration backfills dates and gates deadline enqueue and claim by current records", async () => {
  const sql = await source("db/opportunity-record-classification.sql");
  assert.match(sql, /add column if not exists record_class text/);
  assert.match(sql, /add column if not exists current_validated_at timestamptz/);
  assert.match(sql, /add column if not exists close_date date/);
  assert.match(sql, /new\.record_class := 'evidence'/);
  assert.match(sql, /new\.deadline := null/);
  assert.match(sql, /new\.period_end := coalesce\(new\.period_end, v_raw_period_end, v_parsed_deadline\)/);
  assert.match(sql, /update public\.opportunities\s+set deadline = deadline/);
  assert.match(sql, /opportunity\.record_class = 'current'/);
  assert.match(sql, /opportunity\.current_validated_at >= now\(\) - interval '7 days'/);
  assert.match(sql, /opportunity\.close_date > current_date/);
  assert.match(sql, /public\.parse_opportunity_deadline\(opportunity\.deadline\) = opportunity\.close_date/);
  assert.match(sql, /grant execute on function public\.parse_opportunity_deadline\(text\) to service_role/);
  assert.match(sql, /grant execute on function public\.enqueue_due_deadline_alerts\(integer\) to service_role/);
  assert.match(sql, /grant execute on function public\.claim_pending_deadline_alerts\(integer\) to service_role/);
});
