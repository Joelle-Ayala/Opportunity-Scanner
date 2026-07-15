import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [home, report, scanRoute, dashboardNew] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/dashboard/new/page.tsx", import.meta.url), "utf8")
]);

assert.match(home, /retry\?: string/);
assert.match(home, /\["quality_review", "failed"\]\.includes\(retryScan\.status\)/);
assert.match(home, /defaultValue=\{retryScan\?\.company_url \|\| ""\}/);
assert.match(home, /defaultValue=\{retryScan\?\.opportunity_focus \|\| ""\}/);
assert.match(home, /Your email is intentionally not carried into this form/);
assert.doesNotMatch(home, /defaultValue=\{retryScan\?\.email/);
assert.match(report, /\?retry=\$\{encodeURIComponent\(scan\.id\)\}#scan/);
assert.match(report, /Run a revised scan/);
assert.match(home, /required[\s\S]*minLength=\{15\}[\s\S]*name="opportunityFocus"/);
assert.match(scanRoute, /!opportunityFocus \|\| opportunityFocus\.length < 15/);
assert.match(scanRoute, /error=missing-context#scan/);
assert.match(dashboardNew, /textarea required minLength=\{15\} maxLength=\{2000\} name="opportunityFocus"/);

console.log("Quality-review retry contract tests passed.");
