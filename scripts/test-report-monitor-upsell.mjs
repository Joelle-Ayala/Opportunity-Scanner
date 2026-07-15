import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [reportPage, checkout, onboarding] = await Promise.all([
  source("app/reports/[id]/page.tsx"),
  source("components/report-monitor-checkout.tsx"),
  source("app/dashboard/onboarding/page.tsx")
]);

assert.match(reportPage, /const showReportMonitorUpsell =\s*isPaid/);
assert.match(reportPage, /!isAdminView/);
assert.match(reportPage, /!hasActiveMonitoringPlan/);
assert.match(reportPage, /reportCheckoutIsConfigured\(\)/);
assert.match(reportPage, /showReportMonitorUpsell \? \(/);
assert.match(reportPage, /<ReportMonitorCheckout/);
assert.doesNotMatch(reportPage, /action="\/api\/dashboard\/searches"/);

assert.match(checkout, /\$99/);
assert.match(checkout, /per month/);
assert.match(checkout, /Weekly opportunity scans/);
assert.match(checkout, /New opportunity alerts/);
assert.match(checkout, /Monitor This Report Weekly/);
assert.doesNotMatch(checkout, /changed signal|changes to the signals/i);
assert.match(checkout, /fetch\("\/api\/checkout"/);
assert.match(checkout, /plan: "monitor"/);
assert.match(checkout, /billingInterval: "monthly"/);
assert.match(checkout, /scanId: null/);
assert.match(checkout, /url\.origin === "https:\/\/checkout\.stripe\.com"/);
assert.doesNotMatch(checkout, /access(?:Token|Code)?\s*:/);

assert.match(onboarding, /resolveCustomerSession\(/);
assert.match(onboarding, /loadDashboardReports\(session\.user\.id\)/);
assert.match(onboarding, /report\.status === "completed"/);
assert.match(onboarding, /<input type="hidden" name="scanId" value=\{report\.scanId\} \/>/);

console.log("Report-to-monitor upsell tests passed.");
