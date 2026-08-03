import assert from "node:assert/strict";
import test from "node:test";
import { generateCompanyProfile } from "../lib/profile.ts";
import type { ScanInput } from "../lib/types.ts";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;

function richInput(overrides: Partial<ScanInput>): ScanInput {
  return {
    companyUrl: "https://example.com",
    companyName: "Example",
    headquartersState: "California",
    targetStates: "California, Texas, New York",
    customerType: "B2B",
    reportType: "deep",
    prioritySignals: ["active_contracts", "funded_buyers"],
    ...overrides
  };
}

test.beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
});

test.after(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
  if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  if (originalOidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
  else process.env.VERCEL_OIDC_TOKEN = originalOidcToken;
});

test("detailed vertical scan inputs remain held when AI profiling is unavailable", async () => {
  const cases = [
    {
      label: "Reparel",
      input: richInput({
        companyName: "Reparel",
        companyUrl: "https://reparel.com",
        industry: "Healthcare, rehab, DME, and medical supply",
        customerType: "Healthcare",
        opportunityFocus:
          "Find VA and public healthcare purchasing, funded rehabilitation buyers, and medical supply distributor opportunities for compression recovery products.",
        includeTerms:
          "compression garments; durable medical equipment; orthotic supplies; prosthetic rehabilitation; medical supply distributors",
        excludeTerms: "general wellness; unrelated hospital construction"
      }),
      rawText:
        "Reparel makes compression recovery sleeves and medical support products for rehabilitation providers, orthotic suppliers, and durable medical equipment channels.",
      playbookId: "healthcare_rehab_dme"
    },
    {
      label: "SchoolGig",
      input: richInput({
        companyName: "SchoolGig",
        companyUrl: "https://schoolgig.us",
        industry: "Education workforce and teacher staffing",
        customerType: "Education",
        opportunityFocus:
          "Find school district teacher recruitment, educator workforce grants, staffing partnerships, and government recruiting technology procurement.",
        includeTerms:
          "teacher recruitment; educator workforce; school staffing; applicant tracking systems; arts education staffing",
        excludeTerms: "student scholarships; unrelated healthcare staffing"
      }),
      rawText:
        "SchoolGig is a teacher hiring and school district recruiting platform supporting educator staffing, candidate pipelines, and arts education hiring.",
      playbookId: "education_workforce_training"
    },
    {
      label: "Jammcard",
      input: richInput({
        companyName: "Jammcard",
        companyUrl: "https://jammcard.com",
        industry: "Music, arts, creative economy, and live performance",
        opportunityFocus:
          "Find city and county live performance budgets, public event procurement, cultural programming, and funded creative workforce partners.",
        includeTerms:
          "artist booking; live music performance; cultural programming; public concerts; event entertainment services",
        excludeTerms: "recording equipment purchases; unrelated music therapy"
      }),
      rawText:
        "Jammcard is a musician network and artist booking marketplace for live events, cultural programming, concerts, and event entertainment.",
      playbookId: "music_arts_creative_economy"
    }
  ];

  for (const fixture of cases) {
    const profile = await generateCompanyProfile(fixture.input, fixture.rawText);
    assert.ok(
      (profile.profile_confidence_score ?? 100) < 55,
      `${fixture.label} fallback confidence should remain below 55`
    );
    assert.ok(
      profile.selected_playbooks.some((playbook) => playbook.playbook_id === fixture.playbookId),
      `${fixture.label} should select ${fixture.playbookId}`
    );
    assert.match(profile.report_guidance.join(" "), /hold results for review/i);
  }
});

test("minimal vague input remains below the publication threshold", async () => {
  const profile = await generateCompanyProfile(
    {
      companyUrl: "https://example.com",
      reportType: "quick",
      opportunityFocus: "Find some opportunities."
    },
    "Example provides services."
  );

  assert.ok((profile.profile_confidence_score ?? 100) < 55);
  assert.match(profile.report_guidance.join(" "), /hold results for review/i);
});

test("detailed public-form intent produces a useful but held fallback", async () => {
  const profile = await generateCompanyProfile(
    {
      companyUrl: "https://reparel.com",
      reportType: "quick",
      opportunityFocus:
        "We sell medical-grade compression garments and recovery products. Find current VA, HHS, hospital, rehab, prosthetics and orthotics, DME purchasing, reimbursement, funded-buyer, distribution, and channel-partner opportunities we can pursue."
    },
    "Reparel makes clinically proven recovery sleeves for arthritis, injury, and post-operative healing."
  );

  assert.ok((profile.profile_confidence_score ?? 100) < 55);
  assert.ok((profile.inferred_products_services ?? []).length >= 2);
  assert.ok((profile.inferred_target_customers ?? []).length >= 2);
  assert.match(profile.summary, /appears to offer/i);
  assert.doesNotMatch(profile.summary, /^URL:/i);
  assert.match(profile.report_guidance.join(" "), /hold results for review/i);
});

test("non-OK OpenAI responses log only status and model", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-profile-model";
  let requestCount = 0;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestCount += 1;
    requestBody = JSON.parse(String(init?.body));
    return new Response(null, { status: 429, headers: { "Retry-After": "0" } });
  };
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    await generateCompanyProfile(
      {
        companyUrl: "https://example.com",
        reportType: "quick",
        opportunityFocus: "Find opportunities."
      },
      "Example provides services."
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
    delete process.env.OPENAI_API_KEY;
  }

  assert.deepEqual(warnings, [
    [
      "Company profile model request failed",
      { status: 429, model: "test-profile-model", provider: "openai" }
    ]
  ]);
  assert.equal(requestCount, 2);
  assert.deepEqual(requestBody.response_format, { type: "json_object" });
});

test("malformed OpenAI profile output falls back into review", async () => {
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ company_name: "Unsupported Example" }) } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const profile = await generateCompanyProfile(
      {
        companyUrl: "https://example.com",
        reportType: "quick",
        opportunityFocus: "Find public-sector buyers for recruiting software."
      },
      "Example builds recruiting software for education employers."
    );
    assert.ok((profile.profile_confidence_score ?? 100) < 55);
    assert.match(profile.report_guidance.join(" "), /hold results for review/i);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("Vercel OIDC uses AI Gateway before provider-specific credentials", async () => {
  const originalFetch = globalThis.fetch;
  process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
  process.env.OPENAI_API_KEY = "test-openai-key";
  let requestedUrl = "";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      choices: [{ message: { content: `\`\`\`json\n${JSON.stringify({
        company_name: "Gateway Example",
        website: "https://example.com",
        summary: "Gateway Example provides recruiting software.",
        products_services: ["recruiting software"],
        target_customers: ["education employers"],
        industries: ["education technology"],
        geographies: ["United States"],
        keywords: ["recruiting", "education"],
        public_sector_search_terms: ["teacher recruiting software"],
        negative_keywords: ["jobs"],
        opportunity_lanes: ["Government recruiting technology"],
        lane_search_terms: { "Government recruiting technology": ["teacher recruiting software"] },
        selected_playbooks: [],
        report_guidance: [],
        profile_confidence_score: 80
      })}\n\`\`\`` } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const profile = await generateCompanyProfile(
      { companyUrl: "https://example.com", reportType: "quick", opportunityFocus: "Find public education buyers." },
      "Gateway Example provides recruiting software for education employers."
    );
    assert.equal(requestedUrl, "https://ai-gateway.vercel.sh/v1/chat/completions");
    assert.equal(requestBody.response_format, undefined);
    assert.equal(profile.company_name, "Gateway Example");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.OPENAI_API_KEY;
  }
});
