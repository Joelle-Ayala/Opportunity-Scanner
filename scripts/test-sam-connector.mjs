import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

if (!process.execArgv.includes("--experimental-strip-types")) {
  const rerun = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--import",
      "./scripts/register-ts-test-hooks.mjs",
      process.argv[1]
    ],
    { cwd: process.cwd(), encoding: "utf8", stdio: "inherit" }
  );
  process.exit(rerun.status ?? 1);
}

const {
  buildSamQueryPlan,
  collectSamSearchTerms,
  SAM_MAX_REQUESTS,
  SAM_MAX_SEARCH_TERMS,
  searchSamGov
} = await import("../lib/connectors/samGov.ts");
const { ConnectorDiagnostics, runConnector } = await import("../lib/connectors/runtime.ts");

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
  assert.equal(terms.length, SAM_MAX_SEARCH_TERMS, `${company} should retain three prioritized terms`);
  assert.equal(new Set(terms.map((term) => term.toLowerCase().trim())).size, terms.length);
  assert.ok(plan.length <= SAM_MAX_REQUESTS, `${company} exceeded the SAM request cap`);
  assert.equal(plan.filter((entry) => entry.semantics === "active_notice").length, terms.length);
  assert.equal(plan.filter((entry) => entry.semantics === "award_notice").length, 1);
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

  assert.equal(
    requests.length,
    SAM_MAX_SEARCH_TERMS,
    "a verified live result should avoid the SAM award fallback"
  );
  assert.equal(result.run.request_count, SAM_MAX_SEARCH_TERMS);
  assert.equal(result.run.outcome, "matches_found");
  assert.equal(result.run.partial_failure_count, 0);
  assert.equal(result.signals.length, 3, "live search duplicates should be removed across query groups");
  assert.deepEqual(requests[0].searchParams.getAll("ptype"), ["o", "k", "r", "s", "p"]);
  assert.notDeepEqual(requests.at(-1).searchParams.getAll("ptype"), ["a"]);

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

  const awardRequests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    awardRequests.push(url);
    const isAwardRequest = url.searchParams.getAll("ptype").includes("a");
    return new Response(JSON.stringify({
      opportunitiesData: isAwardRequest
        ? [{
            noticeId: "award-1",
            title: "Orthotic supply award",
            department: "Department of Veterans Affairs",
            type: "Award Notice",
            active: "No",
            award: {
              amount: 25000,
              date: "2025-09-15",
              awardee: { name: "Example Medical Supplier" }
            }
          }]
        : []
    }), { status: 200 });
  };
  const awardFallback = await runConnector({
    sourceId: "sam.gov",
    sourceName: "SAM.gov",
    enabled: true,
    credentialRequired: true,
    credentialConfigured: true,
    nextTest: "Run the evidence fallback regression.",
    notes: "Deterministic SAM evidence fallback.",
    execute: (context) => searchSamGov(profiles.Reparel, context)
  });
  assert.equal(awardRequests.length, SAM_MAX_REQUESTS);
  assert.deepEqual(awardRequests.at(-1).searchParams.getAll("ptype"), ["a"]);
  const award = awardFallback.signals.find((signal) => signal.raw_json.noticeId === "award-1");
  assert.equal(award?.source_type, "funded_buyer");
  assert.equal(award?.revenue_pathway, "sell_to_grantee");
  assert.equal(award?.actionability, "maybe");
  assert.equal(award?.record_class, "evidence");
  assert.equal(award?.award_year, 2025);
  assert.equal(award?.deadline, "");

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

  let quotaRequests = 0;
  globalThis.fetch = async () => {
    quotaRequests += 1;
    return new Response(JSON.stringify({ error: "quota" }), {
      status: 429,
      headers: { "Retry-After": "60" }
    });
  };
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
  assert.equal(quotaFailure.run.request_count, 1, "SAM should stop after the first quota response");
  assert.equal(quotaRequests, 1, "SAM should not spend more query budget after a 429");
  assert.match(quotaFailure.run.error_message ?? "", /retry after 60 second/i);
  assert.doesNotMatch(quotaFailure.run.error_message ?? "", /test-key|api_key/i);

  let partialRequests = 0;
  globalThis.fetch = async () => {
    partialRequests += 1;
    if (partialRequests === 1) {
      return new Response(JSON.stringify({ opportunitiesData: [
        {
          noticeId: "partial-active-1",
          title: "Orthotic and prosthetic supplies",
          solicitationNumber: "VA-PARTIAL-1",
          fullParentPathName: "Department of Veterans Affairs / Prosthetics Office",
          responseDeadLine: "2099-08-15",
          type: "Solicitation",
          active: "Yes",
          uiLink: "https://sam.gov/opp/partial-active-1/view"
        }
      ] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "quota" }), {
      status: 429,
      headers: { "Retry-After": "120" }
    });
  };
  const partialQuota = await runConnector({
    sourceId: "sam.gov",
    sourceName: "SAM.gov",
    enabled: true,
    credentialRequired: true,
    credentialConfigured: true,
    nextTest: "Preserve usable results before quota exhaustion.",
    notes: "Partial quota regression.",
    execute: (context) => searchSamGov(profiles.Reparel, context)
  });
  assert.equal(partialQuota.run.status, "active");
  assert.equal(partialQuota.run.outcome, "matches_found");
  assert.equal(partialQuota.run.request_count, 2);
  assert.equal(partialQuota.run.partial_failure_count, 1);
  assert.equal(partialQuota.signals.length, 1);
  assert.equal(partialQuota.signals[0].record_class, "current");
  assert.equal(partialQuota.signals[0].deadline, "2099-08-15");
  assert.equal(partialRequests, 2, "SAM should stop immediately after a partial 429");

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

  console.log("PASS SAM query plan: live-first and capped at four grouped requests with normalized term deduplication");
  console.log("PASS SAM regressions: Reparel, Jammcard, and SchoolGig retain industry-specific terms");
  console.log("PASS SAM mapping: active notices, sources sought, awards, URLs, deadlines, and contacts remain distinct");
  console.log("PASS SAM runtime: 429 circuit breaking preserves partial results and cancellation remains distinct");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.SAM_API_KEY;
  else process.env.SAM_API_KEY = originalKey;
}
