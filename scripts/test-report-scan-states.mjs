import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [reportPage, types] = await Promise.all([
  source("app/reports/[id]/page.tsx"),
  source("lib/types.ts")
]);

const scanRecord = types.match(/export type ScanRecord = \{([\s\S]*?)\n\};/);
assert.ok(scanRecord, "ScanRecord contract must remain discoverable");

const statusContract = scanRecord[1].match(/status:\s*([^;]+);/);
assert.ok(statusContract, "ScanRecord must declare supported statuses");

const supportedStatuses = [...statusContract[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(supportedStatuses, [
  "queued",
  "scraping",
  "profiling",
  "discovering",
  "completed",
  "failed"
]);

const progressContract = reportPage.match(/const IN_PROGRESS_SCAN_COPY:[\s\S]*?= \{([\s\S]*?)\n\};/);
assert.ok(progressContract, "Report page must define in-progress copy as an exhaustive status contract");

const progressStatuses = [...progressContract[1].matchAll(/^  (\w+): \{/gm)].map((match) => match[1]);
assert.deepEqual(progressStatuses, ["queued", "scraping", "profiling", "discovering"]);
assert.match(reportPage, /Exclude<ScanRecord\["status"\], "completed" \| "failed">/);

const expectedExperience = new Map([
  ["queued", "in-progress"],
  ["scraping", "in-progress"],
  ["profiling", "in-progress"],
  ["discovering", "in-progress"],
  ["completed", "completed-report"],
  ["failed", "failed"]
]);

for (const status of supportedStatuses) {
  assert.ok(expectedExperience.has(status), `Missing deterministic report experience for ${status}`);
}

const pageEntry = reportPage.slice(reportPage.indexOf("export default async function ReportPage"));
const stateGuard = pageEntry.indexOf('if (scan.status !== "completed")');
const accessLookup = pageEntry.indexOf("const storedAccess = await hasServerReportAccess");
const reportAnalytics = pageEntry.indexOf("<ReportAnalytics");
assert.ok(stateGuard >= 0, "Non-completed scans must exit through a dedicated state view");
assert.ok(stateGuard < accessLookup, "State guard must run before report access and checkout work");
assert.ok(stateGuard < reportAnalytics, "State guard must run before completed-report analytics");
assert.match(pageEntry, /return <ReportScanState scan=\{scan\} isAdminView=\{isAdminView\} \/>/);

const stateViewStart = reportPage.indexOf("function ReportScanState");
const stateViewEnd = reportPage.indexOf("function fullReportRequestHref", stateViewStart);
assert.ok(stateViewStart >= 0 && stateViewEnd > stateViewStart, "Dedicated scan state view must remain isolated");
const stateView = reportPage.slice(stateViewStart, stateViewEnd);

for (const completedOnlySurface of [
  "PurchaseCompletedAnalytics",
  "ReportHeader",
  "ExecutiveSummaryCard",
  "OpportunityActionTable",
  "UnlockCTA",
  "SendToWorkflowModal",
  "ReportMonitorCheckout",
  "Workflow Actions",
  "Report CSV",
  "Outreach CSV",
  "Outreach MD",
  "Source matches",
  "Action-table rows",
  "Rows shown",
  "Rows locked"
]) {
  assert.ok(!stateView.includes(completedOnlySurface), `${completedOnlySurface} must stay out of non-success states`);
}

assert.match(
  stateView,
  /<ReportAnalytics[\s\S]*?status=\{scan\.status\}/,
  "Non-success states must report their authoritative status without mounting completed-report content"
);

assert.match(stateView, /scan\.status === "failed"/);
assert.match(stateView, /href=\{`\/dashboard\/new\?from=\$\{encodeURIComponent\(scan\.id\)\}`\}/);
assert.match(stateView, /href=\{scanSupportHref\(scan\)\}/);
assert.match(
  stateView,
  /\{isAdminView && scan\.error_message \? \([\s\S]*?Admin failure detail[\s\S]*?\{scan\.error_message\}[\s\S]*?\) : null\}/
);
assert.equal(stateView.match(/scan\.error_message/g)?.length, 2, "Failure detail must only appear in its admin gate");

for (const completedSurface of ["<ReportAnalytics", "<ReportHeader", "<ExecutiveSummaryCard", "<UnlockCTA"] ) {
  assert.ok(pageEntry.includes(completedSurface), `Completed report must preserve ${completedSurface}`);
}

for (const summaryLabel of ["Source matches", "Action-table rows", "Rows shown", "Rows locked"]) {
  assert.match(reportPage, new RegExp(summaryLabel), `Completed reports must label ${summaryLabel}`);
}
assert.match(pageEntry, /sourceMatches: signals\.length/);
assert.match(pageEntry, /actionTableRows: reportSignals\.length/);
assert.match(pageEntry, /shownRows: displayedSignals\.length/);
assert.match(pageEntry, /lockedRows: lockedSignals\.length/);
assert.match(
  reportPage,
  /rows shown plus rows locked equal the action-table total/,
  "The report must explain how preview counts reconcile"
);

console.log("Report scan state contract tests passed.");
