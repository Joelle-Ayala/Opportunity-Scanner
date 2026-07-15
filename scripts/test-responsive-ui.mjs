import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [brand, homepage, marketingContent, sampleReports, reportPage, articleCharts, sampleReport, dashboardShell, workflow] = await Promise.all([
  source("components/brand.tsx"),
  source("app/page.tsx"),
  source("lib/marketingContent.ts"),
  source("lib/sampleReports.ts"),
  source("app/reports/[id]/page.tsx"),
  source("components/resources/article-charts.tsx"),
  source("components/sample-report.tsx"),
  source("components/dashboard/dashboard-shell.tsx"),
  source("components/workflow.tsx")
]);

const industryStart = marketingContent.indexOf("export const industryPages");
const industryEnd = marketingContent.indexOf("const baseResourceArticles", industryStart);
const industryBlock = marketingContent.slice(industryStart, industryEnd);
const industrySlugs = [...industryBlock.matchAll(/slug: "([^"]+)"/g)].map((match) => match[1]);

assert.equal(industrySlugs.length, 9, "expected the nine published industry pages");
for (const slug of industrySlugs) {
  assert.match(brand, new RegExp(`/industries/${slug}`), `navigation is missing industry: ${slug}`);
}

assert.match(brand, /aria-label="Mobile navigation"/);
assert.match(brand, /max-h-\[calc\(100dvh-5rem\)\]/);
assert.match(brand, /Customer Dashboard/);
assert.match(brand, />\s*Account\s*</);
assert.match(brand, /Account &amp; reports/);
assert.match(brand, /src="\/opportunity-scanner-logo\.svg"/);
assert.match(homepage, /fictional CivicStage example/i);
assert.match(sampleReports, /fictionalClient: "CivicStage Talent Network"/);
assert.doesNotMatch(homepage, /Jammcard/i);
assert.doesNotMatch(sampleReports, /Jammcard/i);

const mobileCardStart = reportPage.indexOf("function OpportunitySignalCard");
const mobileCardEnd = reportPage.indexOf("function LockedOpportunityCard", mobileCardStart);
const mobileCard = reportPage.slice(mobileCardStart, mobileCardEnd);
assert.match(mobileCard, /PrimaryActionButton/);
assert.match(mobileCard, /SendToWorkflowModal/);
assert.match(mobileCard, /GrowthContactLookupControl/);
assert.match(mobileCard, /lookupAccess=\{lookupAccess\}/);
assert.ok(
  reportPage.indexOf("<OpportunitySignalCard", reportPage.indexOf("<ExecutiveSummaryCard"))
    < reportPage.indexOf("<OpportunityProfileModule", reportPage.indexOf("<ExecutiveSummaryCard")),
  "mobile opportunity cards should appear before secondary profile analysis"
);

assert.match(articleCharts, /min-w-\[44rem\]/);
assert.match(articleCharts, /Open visual full size/);
assert.match(sampleReport, /w-full min-w-0[^"]+sm:min-w-\[16rem\]/);
assert.match(dashboardShell, /shortLabel: "Searches"/);
assert.match(dashboardShell, /grid grid-cols-3 gap-x-2 sm:flex/);
assert.doesNotMatch(dashboardShell, /overflow-x-auto[^\n]+Dashboard sections/);
assert.match(workflow, /role="dialog"/);
assert.match(workflow, /aria-modal="true"/);

console.log(`Responsive UI verification passed: ${industrySlugs.length}/${industrySlugs.length} industry routes are present in navigation.`);
console.log("Mobile report actions, visual readability, narrow layouts, dashboard tabs, and dialog semantics are guarded.");
