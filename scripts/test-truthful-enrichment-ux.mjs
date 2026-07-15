import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [route, opportunityPage, reportPage, homePage] = await Promise.all([
  source("app/api/opportunities/enrich/route.ts"),
  source("app/opportunities/[id]/page.tsx"),
  source("app/reports/[id]/page.tsx"),
  source("app/page.tsx")
]);

assert.match(route, /enrichmentType !== "find_contacts"/);
assert.match(route, /This enrichment action is not available/);
assert.doesNotMatch(route, /"find_similar_awards"|"search_active_bids"|"search_grants"|"find_buyer_website"|"generate_outreach"/);
assert.doesNotMatch(route, /searchParams\.set\("enrichment", "requested"\)/);
assert.match(route, /\["failed", "not_configured", "needs_domain", "needs_target"\]\.includes\(resultStatus\)/);
assert.match(route, /enrichmentOutcome = "unavailable"/);
assert.match(route, /searchParams\.set\("enrichment", enrichmentOutcome\)/);

assert.doesNotMatch(opportunityPage, /Find similar awards|Search active bids|Search grants|Find buyer website|Generate outreach angle/);
assert.doesNotMatch(opportunityPage, /work queue|Request enrichment/);
assert.match(opportunityPage, /resolveRequestReportAccess/);
assert.match(opportunityPage, /loadEnrichmentCreditBalance\(reportAccess\.authUserId\)/);
assert.match(opportunityPage, /Person-level lookup requires a signed-in Growth plan and can use one monthly contact credit/);
assert.match(opportunityPage, /Growth credits:[\s\S]*creditBalance\.remaining[\s\S]*creditBalance\.limit/);
assert.match(opportunityPage, /contactLookupCanRun|Run Contact Lookup/);
assert.match(opportunityPage, /contactEnrichmentRequests = enrichmentRequests\.filter/);
assert.match(opportunityPage, /Contact lookup completed/);
assert.match(opportunityPage, /Contact lookup did not complete/);

const reportLookupStart = reportPage.indexOf("function GrowthContactLookupControl");
const reportLookupEnd = reportPage.indexOf("function PrimaryActionButton", reportLookupStart);
const reportLookup = reportPage.slice(reportLookupStart, reportLookupEnd);
assert.ok(reportLookupStart >= 0 && reportLookupEnd > reportLookupStart, "report lookup control must exist");
assert.match(reportPage, /subscription\.product === "growth"[\s\S]*\["active", "trialing"\]/);
assert.match(reportLookup, /if \(!isPaid \|\| !lookupAccess\.hasGrowthPlan\)[\s\S]*Person-level contact lookup is Growth-only/);
assert.ok(
  reportLookup.indexOf("if (!isPaid || !lookupAccess.hasGrowthPlan)") < reportLookup.indexOf('<form action="/api/opportunities/enrich"'),
  "the report must gate the enrichment form before it can render"
);
assert.match(reportLookup, /Growth credits:[\s\S]*creditBalance\.remaining[\s\S]*creditBalance\.limit/);
assert.match(reportLookup, /This person-level lookup can use one[\s\S]*may not return a verified contact/);
assert.match(reportLookup, /Run Growth Contact Lookup/);
assert.doesNotMatch(reportLookup, />\s*Find Contacts\s*</);
assert.match(reportLookup, /Full report and Monitor access still include the source-native contact path/);
assert.equal((reportPage.match(/<GrowthContactLookupControl/g) ?? []).length, 3);

assert.match(homePage, /source-native contact paths/);
assert.match(homePage, /Person-level contact enrichment is Growth-only and uses capped monthly credits/);

console.log("PASS truthful enrichment UX: person-level lookup is Growth-gated before submission and source-native contact paths remain available");
