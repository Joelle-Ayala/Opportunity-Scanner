import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [dashboard, savedSearchList, onboarding, createRoute] = await Promise.all([
  source("app/dashboard/page.tsx"),
  source("components/dashboard/saved-search-list.tsx"),
  source("app/dashboard/onboarding/page.tsx"),
  source("app/api/dashboard/searches/route.ts")
]);

assert.match(
  dashboard,
  /capacityUsedCount = subscription[\s\S]*search\.monitoredProfile\.status !== "canceled"/,
  "dashboard capacity must count every non-canceled monitored profile"
);
assert.match(
  dashboard,
  /hasMonitoringCapacity = Boolean\(subscription && capacityUsedCount < profileLimit\)/,
  "the add path must only appear below the active plan limit"
);
assert.match(
  dashboard,
  /needsMonitoringSetup = Boolean\(subscription && capacityUsedCount === 0\)/,
  "setup state must be based on monitored-profile capacity, not the saved-search row count"
);
assert.match(
  dashboard,
  /report\.status === "completed" && !monitoredSourceScanIds\.has\(report\.scanId\)/,
  "direct monitor links must be limited to completed reports not already monitored"
);
assert.match(
  dashboard,
  /hasMonitoringCapacity && eligibleMonitoringReportIds\.has\(report\.id\)[\s\S]*dashboard\/onboarding\?source_scan_id=/,
  "eligible report links must enter the existing onboarding flow and disappear at capacity"
);
assert.match(
  dashboard,
  /label: "Monitored profiles", used: capacityUsedCount, limit: profileLimit/,
  "usage must show capacity consumed by paused as well as active profiles"
);
assert.match(dashboard, />Add monitored search<\/a>/, "dashboard must expose the add-monitor CTA");

assert.match(
  savedSearchList,
  /monitoringCapacity\.used >= monitoringCapacity\.limit/,
  "the list must derive its limit-reached state from plan capacity"
);
assert.match(
  savedSearchList,
  /monitoringLimitReached \? \([\s\S]*Plan limit reached[\s\S]*\) : addMonitoringAction/,
  "the list must suppress the add action once the limit is reached"
);

assert.match(onboarding, /capacityUsedCount >= limit/);
assert.match(onboarding, /eligibleReports\.find\(\(report\) => report\.scanId === requestedSourceScanId\)/);
assert.match(createRoute, /createMonitoredSearchFromScan\(session\.user\.id, scanId\)/);

console.log("Dashboard monitoring capacity, eligible-report routing, and limit states are guarded.");
