import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

const [route, page] = await Promise.all([
  source("app/api/opportunities/enrich/route.ts"),
  source("app/opportunities/[id]/page.tsx")
]);

assert.match(route, /enrichmentType !== "find_contacts"/);
assert.match(route, /This enrichment action is not available/);
assert.doesNotMatch(route, /"find_similar_awards"|"search_active_bids"|"search_grants"|"find_buyer_website"|"generate_outreach"/);
assert.doesNotMatch(route, /searchParams\.set\("enrichment", "requested"\)/);
assert.match(route, /\["failed", "not_configured", "needs_domain", "needs_target"\]\.includes\(resultStatus\)/);
assert.match(route, /enrichmentOutcome = "unavailable"/);
assert.match(route, /searchParams\.set\("enrichment", enrichmentOutcome\)/);

assert.doesNotMatch(page, /Find similar awards|Search active bids|Search grants|Find buyer website|Generate outreach angle/);
assert.doesNotMatch(page, /work queue|Request enrichment/);
assert.match(page, /resolveRequestReportAccess/);
assert.match(page, /loadEnrichmentCreditBalance\(reportAccess\.authUserId\)/);
assert.match(page, /Person-level lookup requires a signed-in Growth plan and can use one monthly contact credit/);
assert.match(page, /Growth credits:[\s\S]*creditBalance\.remaining[\s\S]*creditBalance\.limit/);
assert.match(page, /contactLookupCanRun|Run Contact Lookup/);
assert.match(page, /contactEnrichmentRequests = enrichmentRequests\.filter/);
assert.match(page, /Contact lookup completed/);
assert.match(page, /Contact lookup did not complete/);

console.log("PASS truthful enrichment UX: unsupported actions are rejected and contact requirements are disclosed before submission");
