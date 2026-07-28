import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const reportPage = await readFile(new URL("app/reports/[id]/page.tsx", ROOT), "utf8");
const dashboardPage = await readFile(new URL("app/dashboard/page.tsx", ROOT), "utf8");

assert.match(reportPage, /type ReportRecordClass = "current" \| "evidence"/);
assert.match(reportPage, /record_class\?: ReportRecordClass \| null/);
assert.match(reportPage, /current_validated_at\?: string \| null/);
assert.match(reportPage, /award_year\?: number \| null/);
assert.match(reportPage, /period_end\?: string \| null/);
assert.match(reportPage, /deadline\?: string \| null/);

const classifierStart = reportPage.indexOf("function signalFreshness");
const classifierEnd = reportPage.indexOf("function formatReportDate", classifierStart);
assert.ok(classifierStart >= 0 && classifierEnd > classifierStart, "Freshness classifier must remain local and focused");
const classifier = reportPage.slice(classifierStart, classifierEnd);

assert.match(classifier, /fields\.record_class === "current"/);
assert.match(classifier, /validatedAt !== null/);
assert.match(classifier, /validationAgeMs <= CURRENT_VALIDATION_MAX_AGE_MS/);
assert.match(classifier, /deadline !== null/);
assert.match(classifier, /deadline\.getTime\(\) > now\.getTime\(\)/);
assert.match(classifier, /recordClass: hasVerifiedFutureDeadline \? "current" : "evidence"/);
assert.match(classifier, /deadline: hasVerifiedFutureDeadline \? deadline : null/);

const freshnessContextStart = reportPage.indexOf("function FreshnessContext");
const freshnessContextEnd = reportPage.indexOf("function hostname", freshnessContextStart);
assert.ok(
  freshnessContextStart >= 0 && freshnessContextEnd > freshnessContextStart,
  "Report must use one freshness presentation boundary"
);
const freshnessContext = reportPage.slice(freshnessContextStart, freshnessContextEnd);

assert.match(freshnessContext, /freshness\.recordClass === "current" && freshness\.deadline/);
assert.equal(
  freshnessContext.match(/Deadline:/g)?.length,
  1,
  "Deadline must render only once, inside the verified-current branch"
);
assert.match(freshnessContext, /Live opportunity/);
assert.match(freshnessContext, /Funded-buyer evidence/);
assert.match(freshnessContext, /Award year:/);
assert.match(freshnessContext, /Period of performance ended/);
assert.match(freshnessContext, /not deadline-driven pursuit/);

const workflowStart = reportPage.indexOf("function reportWorkflowPayload");
const workflowEnd = reportPage.indexOf("function buildExecutiveSummary", workflowStart);
const workflowPayload = reportPage.slice(workflowStart, workflowEnd);
assert.match(workflowPayload, /recordClass === "current"/);
assert.match(workflowPayload, /sourceStatus: "Funded-buyer evidence"/);
assert.match(workflowPayload, /sourceDeadline: undefined/);
assert.match(workflowPayload, /timeSensitivity: "historical"/);
assert.doesNotMatch(reportPage, /payload=\{buildWorkflowPayload/);

for (const requiredSurface of [
  'signals={displayedLiveSignals}',
  'recordClass="current"',
  'signals={displayedEvidenceSignals}',
  'recordClass="evidence"',
  "Live opportunities",
  "Funded-buyer evidence"
]) {
  assert.ok(reportPage.includes(requiredSurface), `Missing separated report surface: ${requiredSurface}`);
}

assert.match(
  reportPage,
  /\{lockedLiveSignals\.length\} live opportunities · \{lockedEvidenceSignals\.length\} funded-buyer signals/
);
assert.match(
  reportPage,
  /\{lockedLiveRows\} live opportunities · \{lockedEvidenceRows\} funded-buyer signals/
);
assert.doesNotMatch(reportPage, /signal\.deadline/);
assert.doesNotMatch(reportPage, /fields\.deadline[^;\n]*[<>]/);

const lockedCardStart = reportPage.indexOf("function LockedOpportunityCard");
const lockedCardEnd = reportPage.indexOf("function UnlockCTA", lockedCardStart);
const lockedCard = reportPage.slice(lockedCardStart, lockedCardEnd);
assert.match(lockedCard, /isCurrent \? classification\.source_status : "Historical buyer-budget evidence"/);
assert.match(lockedCard, /isCurrent \? \(/);

assert.match(dashboardPage, /newLiveCount/);
assert.match(dashboardPage, /newEvidenceCount/);
assert.match(dashboardPage, /new funded-buyer/);
assert.match(dashboardPage, /new \$\{newSignalCount === 1 \? "signal" : "signals"\} found/);
assert.doesNotMatch(
  dashboardPage,
  /run\.newOpportunityCount[\s\S]{0,160}new \$\{run\.newOpportunityCount === 1 \? "opportunity"/
);

console.log("Report data freshness UI contract tests passed.");
