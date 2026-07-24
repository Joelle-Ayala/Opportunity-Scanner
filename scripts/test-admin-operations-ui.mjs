import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");
const [
  layout,
  shell,
  operations,
  operationsUi,
  reports,
  reportInspection,
  feedback,
  sources,
  qualityRoute,
  envExample
] = await Promise.all([
  source("app/admin/layout.tsx"),
  source("components/admin/admin-shell.tsx"),
  source("lib/admin/operations.ts"),
  source("components/admin/operations-ui.tsx"),
  source("app/admin/reports/page.tsx"),
  source("app/admin/reports/[id]/page.tsx"),
  source("app/admin/feedback/page.tsx"),
  source("app/admin/sources/page.tsx"),
  source("app/api/admin/scans/[id]/quality-review/route.ts"),
  source(".env.example")
]);

assert.match(layout, /AdminShell/);
for (const href of ["/admin", "/admin/reports", "/admin/feedback", "/admin/sources"]) {
  assert.match(shell, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
}
assert.match(shell, /overflow-x-auto/);
assert.match(shell, /api\/auth\/sign-out/);

for (const content of [reports, reportInspection, feedback, sources]) {
  assert.match(content, /requireAdminPage/);
  assert.match(content, /AdminAccessState/);
  assert.doesNotMatch(content, /hasAdminAccess/);
}

assert.match(operations, /getMonitoringSchedulerEvidence/);
assert.match(operations, /getSubscriptionActivationRecoveryHealth/);
assert.match(operations, /evaluatePaidOpsHealth/);
assert.match(operations, /listAdminScansWithProfiles\(100\)/);
assert.match(operations, /listReportFeedbackWithContext\(250\)/);
assert.doesNotMatch(operationsUi, /stripe_customer_id|scan_id|raw_json|service_role|secret key/i);
assert.match(operationsUi, /Launch readiness/);
assert.match(operationsUi, /Monitoring scheduler/);
assert.match(operationsUi, /Subscription recovery/);
assert.match(operationsUi, /Paid report operations/);

assert.match(feedback, /md:hidden/);
assert.match(feedback, /hidden overflow-x-auto md:block/);
assert.match(sources, /md:hidden/);
assert.match(sources, /hidden overflow-x-auto md:block/);
assert.match(reportInspection, /Open official source/);
assert.match(reportInspection, /Publish report/);
assert.match(reportInspection, /Close as needs revision/);

assert.match(qualityRoute, /authorizeAdminMutation/);
assert.match(qualityRoute, /setSessionCookies/);
assert.match(envExample, /^ADMIN_OPERATOR_EMAILS=$/m);

console.log("Admin operations and responsive UI tests passed.");
