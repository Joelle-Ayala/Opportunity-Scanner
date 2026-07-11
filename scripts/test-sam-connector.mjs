import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const testBuildDir = mkdtempSync(path.join(tmpdir(), "opportunity-scanner-sam-test-"));
process.on("exit", () => rmSync(testBuildDir, { recursive: true, force: true }));

const compile = spawnSync(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules/typescript/bin/tsc"),
    "lib/connectors/samGov.ts",
    "--outDir",
    testBuildDir,
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "es2022",
    "--esModuleInterop",
    "--skipLibCheck"
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);
assert.equal(compile.status, 0, compile.stderr || compile.stdout || "Unable to compile SAM test target");

const require = createRequire(import.meta.url);

const {
  buildSamQueryPlan,
  collectSamSearchTerms,
  SAM_MAX_REQUESTS,
  SAM_MAX_SEARCH_TERMS,
  searchSamGov
} = require(path.join(testBuildDir, "connectors/samGov.js"));
const { ConnectorDiagnostics, runConnector } = require(path.join(testBuildDir, "connectors/runtime.js"));

function profile(companyName, lane, laneTerms, publicTerms = laneTerms) {
  return {
    company_name: companyName,
    website: `https://${companyName.toLowerCase()}.example`,
    summary: "Regression test profile",
    products_services: [],
    target_customers: [],
    industries: [],
    geographies: [],
    keywords: [],
    public_sector_search_terms: publicTerms,
    translated_public_sector_terms: publicTerms,
    negative_keywords: [],
    possible_naics: [],
    possible_psc: [],
    possible_soc: [],
    policy_sensitive_categories: [],
    opportunity_lanes: [lane],
    lane_search_terms: { [lane]: laneTerms },
    opportunity_categories: [],
    selected_playbooks: [],
    activated_source_categories: ["sam.gov"],
    planned_source_categories: [],
    likely_revenue_motions: [],
    suggested_contact_roles: [],
    report_guidance: []
  };
}

const profiles = {
  Reparel: profile(
    "Reparel",
    "VA and medical supply procurement",
    ["VA prosthetics orthotics", "orthotic supplies", "durable medical equipment", "rehabilitation supplies"]
  ),
  Jammcard: profile(
    "Jammcard",
    "Public live performance procurement",
    ["live music services", "music performance", "event entertainment services", "artist booking", "live music services "]
  ),
  SchoolGig: profile(
    "SchoolGig",
    "Education workforce procurement",
    ["teacher recruitment", "school staffing", "applicant tracking system", "education workforce development"]
  )
};

for (const [company, regressionProfile] of Object.entries(profiles)) {
  const terms = collectSamSearchTerms(regressionProfile);
  const plan = buildSamQueryPlan(regressionProfile);
  assert.equal(terms.length, SAM_MAX_SEARCH_TERMS, `${company} should retain four specific terms`);
  assert.equal(new Set(terms.map((term) => term.toLowerCase().trim())).size, terms.length);
  assert.ok(plan.length <= SAM_MAX_REQUESTS, `${company} exceeded the SAM request cap`);
  assert.equal(plan.filter((entry) => entry.semantics === "active_notice").length, terms.length);
  assert.equal(plan.filter((entry) => entry.semantics === "award_notice").length, 2);
}

assert.ok(collectSamSearchTerms(profiles.Reparel).some((term) => /prosthetic|orthotic|medical equipment/i.test(term)));
assert.ok(collectSamSearchTerms(profiles.Jammcard).some((term) => /music|artist|entertainment/i.test(term)));
assert.ok(collectSamSearchTerms(profiles.SchoolGig).some((term) => /teacher|school staffing|applicant tracking/i.test(term)));

const originalFetch = globalThis.fetch;
const originalKey = process.env.SAM_API_KEY;
process.env.SAM_API_KEY = "test-key-never-sent-to-network";

try {
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const isAwardRequest = url.searchParams.getAll("ptype").includes("a");
    const term = url.searchParams.get("title");

    if (term === "VA prosthetics orthotics" && !isAwardRequest) {
      return new Response(JSON.stringify({ opportunitiesData: [
        {
          noticeId: "active-1",
          title: "Orthotic and prosthetic supplies",
          solicitationNumber: "VA-ORTHOTICS-1",
          fullParentPathName: "Department of Veterans Affairs / Prosthetics Office",
          responseDeadLine: "2099-08-15",
          type: "Solicitation",
          active: "Yes",
          uiLink: "https://sam.gov/opp/active-1/view",
          pointOfContact: [{ title: "Contracting Officer", fullName: "Alex Buyer", email: "alex@example.gov" }]
        },
        {
          noticeId: "sought-1",
          title: "Sources sought for rehabilitation supplies",
          department: "Department of Veterans Affairs",
          type: "Sources Sought",
          active: "Yes"
        },
        {
          noticeId: "closed-1",
          title: "Closed solicitation for rehabilitation medical supplies",
          department: "Department of Veterans Affairs",
          responseDeadLine: "2020-08-15",
          type: "Solicitation",
          active: "No"
        }
      ] }), { status: 200 });
    }

    if (term === "VA prosthetics orthotics" && isAwardRequest) {
      return new Response(JSON.stringify({ opportunitiesData: [
        {
          noticeId: "award-1",
          title: "Orthotic supply award",
          department: "Department of Veterans Affairs",
          type: "Award Notice",
          active: "No",
          award: { amount: 25000, awardee: { name: "Example Medical Supplier" } }
        },
        {
          noticeId: "active-1",
          title: "Orthotic and prosthetic supplies",
          type: "Solicitation",
          active: "Yes"
        }
      ] }), { status: 200 });
    }

    return new Response(JSON.stringify({ opportunitiesData: [] }), { status: 200 });
  };

  const result = await runConnector({
    sourceId: "sam.gov",
    sourceName: "SAM.gov",
    enabled: true,
    credentialRequired: true,
    credentialConfigured: true,
    queryPlan: collectSamSearchTerms(profiles.Reparel),
    nextTest: "Run the focused SAM regression.",
    notes: "Deterministic SAM regression.",
    execute: (context) => searchSamGov(profiles.Reparel, context)
  });

  assert.equal(requests.length, SAM_MAX_REQUESTS);
  assert.equal(result.run.request_count, SAM_MAX_REQUESTS);
  assert.equal(result.run.outcome, "matches_found");
  assert.equal(result.run.partial_failure_count, 0);
  assert.equal(result.signals.length, 4, "duplicate notice IDs should be removed across query groups");
  assert.deepEqual(requests[0].searchParams.getAll("ptype"), ["o", "k", "r", "s", "p"]);
  assert.deepEqual(requests.at(-1).searchParams.getAll("ptype"), ["a"]);

  const solicitation = result.signals.find((signal) => signal.raw_json.noticeId === "active-1");
  assert.equal(solicitation?.source_type, "active_contract");
  assert.equal(solicitation?.revenue_pathway, "procurement_bid");
  assert.equal(solicitation?.source_url, "https://sam.gov/opp/active-1/view");
  assert.equal(solicitation?.deadline, "2099-08-15");
  assert.match(solicitation?.best_next_step ?? "", /Alex Buyer/);

  const sourcesSought = result.signals.find((signal) => signal.raw_json.noticeId === "sought-1");
  assert.equal(sourcesSought?.source_type, "procurement_category");
  assert.equal(sourcesSought?.revenue_pathway, "sell_to_agency");
  assert.equal(sourcesSought?.source_url, "https://sam.gov/opp/sought-1/view");

  const award = result.signals.find((signal) => signal.raw_json.noticeId === "award-1");
  assert.equal(award?.source_type, "funded_buyer");
  assert.equal(award?.revenue_pathway, "sell_to_grantee");
  assert.equal(award?.actionability, "maybe");

  const closed = result.signals.find((signal) => signal.raw_json.noticeId === "closed-1");
  assert.equal(closed?.source_type, "procurement_category");
  assert.equal(closed?.revenue_pathway, "sell_to_agency");
  assert.equal(closed?.actionability, "maybe");
  assert.match(closed?.why_it_matters ?? "", /rather than an open bid/);
  assert.match(closed?.best_next_step ?? "", /do not treat it as open for bids/);

  globalThis.fetch = async () => new Response(JSON.stringify({ opportunitiesData: [] }), { status: 200 });
  const zeroMatch = await runConnector({
    sourceId: "sam.gov",
    sourceName: "SAM.gov",
    enabled: true,
    credentialRequired: true,
    credentialConfigured: true,
    nextTest: "Run zero-match regression.",
    notes: "Truthful zero-match regression.",
    execute: (context) => searchSamGov(profiles.Jammcard, context)
  });
  assert.equal(zeroMatch.run.status, "active");
  assert.equal(zeroMatch.run.outcome, "no_matches");
  assert.equal(zeroMatch.run.request_count, SAM_MAX_REQUESTS);

  globalThis.fetch = async () => new Response(JSON.stringify({ error: "quota" }), { status: 429 });
  const quotaFailure = await runConnector({
    sourceId: "sam.gov",
    sourceName: "SAM.gov",
    enabled: true,
    credentialRequired: true,
    credentialConfigured: true,
    nextTest: "Wait for quota reset.",
    notes: "Quota failure regression.",
    execute: (context) => searchSamGov(profiles.SchoolGig, context)
  });
  assert.equal(quotaFailure.run.status, "failing");
  assert.equal(quotaFailure.run.outcome, "failed");
  assert.equal(quotaFailure.run.error_code, "http_error");
  assert.doesNotMatch(quotaFailure.run.error_message ?? "", /test-key|api_key/i);

  const abortController = new AbortController();
  let cancellationRequests = 0;
  globalThis.fetch = async () => {
    cancellationRequests += 1;
    abortController.abort();
    return new Response(JSON.stringify({ opportunitiesData: [] }), { status: 200 });
  };
  await searchSamGov(profiles.Reparel, {
    signal: abortController.signal,
    request_timeout_ms: 100,
    diagnostics: new ConnectorDiagnostics()
  });
  assert.equal(cancellationRequests, 1);

  console.log("PASS SAM query plan: capped at six grouped requests with normalized term deduplication");
  console.log("PASS SAM regressions: Reparel, Jammcard, and SchoolGig retain industry-specific terms");
  console.log("PASS SAM mapping: active notices, sources sought, awards, URLs, deadlines, and contacts remain distinct");
  console.log("PASS SAM runtime: truthful zero matches, quota failures, and cancellation remain distinct");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.SAM_API_KEY;
  else process.env.SAM_API_KEY = originalKey;
}
