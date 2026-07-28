import assert from "node:assert/strict";
import test from "node:test";
import { generateCompanyProfile } from "../lib/profile.ts";
import type { ScanInput } from "../lib/types.ts";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;

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
});

test.after(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = originalModel;
});

test("detailed vertical scan inputs clear the deterministic fallback publication threshold", async () => {
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
      (profile.profile_confidence_score ?? 0) >= 55,
      `${fixture.label} fallback confidence should clear 55`
    );
    assert.ok(
      profile.selected_playbooks.some((playbook) => playbook.playbook_id === fixture.playbookId),
      `${fixture.label} should select ${fixture.playbookId}`
    );
    assert.doesNotMatch(profile.report_guidance.join(" "), /hold results for review/i);
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

test("non-OK OpenAI responses log only status and model", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-profile-model";
  globalThis.fetch = async () => new Response(null, { status: 429 });
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
      "OpenAI company profile request failed",
      { status: 429, model: "test-profile-model" }
    ]
  ]);
});
