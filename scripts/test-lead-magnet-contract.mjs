import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  handleLeadMagnetAccessRequest,
  LEAD_MAGNET_CATALOG
} from "../lib/leadMagnets.ts";

const PLAYBOOK_SLUG = "public-sector-revenue-opportunity-playbook-2026";
const HEALTHCARE_SLUG = "healthcare-dme-public-sector-opportunity-report-2026";
const INDUSTRY_SLUGS = [
  HEALTHCARE_SLUG,
  "education-workforce-public-sector-opportunity-report-2026",
  "creative-economy-live-events-public-sector-opportunity-report-2026",
  "software-ai-public-sector-opportunity-report-2026",
  "infrastructure-construction-public-sector-opportunity-report-2026",
  "clean-energy-facilities-public-sector-opportunity-report-2026",
  "manufacturing-supply-chain-public-sector-opportunity-report-2026",
  "nonprofit-community-services-public-sector-opportunity-report-2026"
];

function requestWith(body, headers = {}) {
  return new Request("http://local.test/api/lead-magnets/access", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

function validBody(overrides = {}) {
  return {
    slug: PLAYBOOK_SLUG,
    name: "  Ada   Lovelace ",
    email: " ADA@EXAMPLE.COM ",
    company: "  Analytical   Engines, Inc. ",
    website: "example.com/company/?tracking=discarded#section",
    source: " resource hub ",
    utm_source: " newsletter ",
    utmMedium: " email ",
    ...overrides
  };
}

function harness(options = {}) {
  const calls = [];
  return {
    calls,
    dependencies: {
      async saveCapture(input) {
        calls.push(input);
        if (options.persistenceFailure) {
          throw new Error("private persistence detail");
        }
        return { id: "capture-1" };
      }
    }
  };
}

async function bodyOf(response) {
  return JSON.parse(await response.text());
}

async function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await bodyOf(response);
  assert.deepEqual(Object.keys(body).sort(), ["error", "ok"]);
  assert.equal(body.ok, false);
  assert.deepEqual(Object.keys(body.error).sort(), ["code", "message"]);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
  return body;
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("catalog contains the flagship and one guide per industry with safe local paths", async () => {
  assert.deepEqual(Object.keys(LEAD_MAGNET_CATALOG).sort(), [PLAYBOOK_SLUG, ...INDUSTRY_SLUGS].sort());
  for (const entry of Object.values(LEAD_MAGNET_CATALOG)) {
    assert.match(entry.accessPath, /^\/lead-magnets\/[a-z0-9-]+\.pdf$/);
    assert.doesNotMatch(entry.accessPath, /:|\/\//);
  }
});

test("rejects malformed and non-object JSON before persistence", async () => {
  for (const body of ["{", "null", "[]"]) {
    const state = harness();
    await assertError(
      await handleLeadMagnetAccessRequest(requestWith(body), state.dependencies),
      400,
      "INVALID_JSON"
    );
    assert.equal(state.calls.length, 0);
  }
});

test("rejects unknown lead magnet slugs", async () => {
  const state = harness();
  await assertError(
    await handleLeadMagnetAccessRequest(
      requestWith(validBody({ slug: "../../private-report" })),
      state.dependencies
    ),
    404,
    "LEAD_MAGNET_NOT_FOUND"
  );
  assert.equal(state.calls.length, 0);
});

test("rejects invalid email addresses", async () => {
  const state = harness();
  await assertError(
    await handleLeadMagnetAccessRequest(requestWith(validBody({ email: "not-an-email" })), state.dependencies),
    400,
    "INVALID_EMAIL"
  );
  assert.equal(state.calls.length, 0);
});

test("rejects invalid websites and individually oversized fields", async () => {
  for (const [overrides, code] of [
    [{ website: "file:///private/guide.pdf" }, "INVALID_WEBSITE"],
    [{ website: "http://user:password@example.com" }, "INVALID_WEBSITE"],
    [{ website: "http://localhost/internal" }, "INVALID_WEBSITE"],
    [{ name: "x".repeat(121) }, "INVALID_NAME"],
    [{ utmCampaign: "x".repeat(161) }, "INVALID_UTM_CAMPAIGN"]
  ]) {
    const state = harness();
    await assertError(
      await handleLeadMagnetAccessRequest(requestWith(validBody(overrides)), state.dependencies),
      400,
      code
    );
    assert.equal(state.calls.length, 0);
  }
});

test("rejects oversized payloads using declared and actual byte length", async () => {
  const declaredState = harness();
  await assertError(
    await handleLeadMagnetAccessRequest(
      requestWith(validBody(), { "Content-Length": "9000" }),
      declaredState.dependencies
    ),
    413,
    "PAYLOAD_TOO_LARGE"
  );
  assert.equal(declaredState.calls.length, 0);

  const actualState = harness();
  await assertError(
    await handleLeadMagnetAccessRequest(
      requestWith(validBody({ company: "x".repeat(9_000) })),
      actualState.dependencies
    ),
    413,
    "PAYLOAD_TOO_LARGE"
  );
  assert.equal(actualState.calls.length, 0);
});

test("rejects client-controlled access URLs and paths", async () => {
  for (const attempt of [
    { accessUrl: "https://attacker.example/download" },
    { accessPath: "/admin/reports" },
    { redirect: "//attacker.example" }
  ]) {
    const state = harness();
    await assertError(
      await handleLeadMagnetAccessRequest(requestWith(validBody(attempt)), state.dependencies),
      400,
      "UNSUPPORTED_FIELD"
    );
    assert.equal(state.calls.length, 0);
  }
});

test("rejects non-boolean marketing consent and unrelated request metadata", async () => {
  for (const attempt of [
    { marketingConsent: "true" },
    { marketingConsent: 1 },
    { ipAddress: "203.0.113.1" },
    { userAgent: "capture-me" },
    { requestMetadata: { arbitrary: true } }
  ]) {
    const state = harness();
    const expectedCode = "marketingConsent" in attempt
      ? "INVALID_MARKETING_CONSENT"
      : "UNSUPPORTED_FIELD";
    await assertError(
      await handleLeadMagnetAccessRequest(requestWith(validBody(attempt)), state.dependencies),
      400,
      expectedCode
    );
    assert.equal(state.calls.length, 0);
  }
});

test("fails closed with a stable user-safe error when persistence fails", async () => {
  const state = harness({ persistenceFailure: true });
  const response = await handleLeadMagnetAccessRequest(requestWith(validBody()), state.dependencies);
  const body = await assertError(response, 503, "ACCESS_UNAVAILABLE");
  assert.equal(state.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(body), /private persistence detail/i);
  assert.equal("accessPath" in body, false);
});

test("persists normalized bounded fields before returning only the catalog access path", async () => {
  for (const slug of [PLAYBOOK_SLUG, ...INDUSTRY_SLUGS]) {
    const state = harness();
    const response = await handleLeadMagnetAccessRequest(
      requestWith(validBody({ slug })),
      state.dependencies
    );
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await bodyOf(response), {
      ok: true,
      leadMagnet: { slug },
      accessPath: LEAD_MAGNET_CATALOG[slug].accessPath
    });
    assert.deepEqual(state.calls, [
      {
        leadMagnetSlug: slug,
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines, Inc.",
        website: "https://example.com/company",
        source: "resource hub",
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        marketingConsent: false,
        consentedAt: null
      }
    ]);
  }
});

test("stores consent only when explicitly true and timestamps it server-side", async () => {
  const state = harness();
  const response = await handleLeadMagnetAccessRequest(
    requestWith(validBody({ marketingConsent: true })),
    state.dependencies
  );
  assert.equal(response.status, 201);
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].marketingConsent, true);
  assert.equal(typeof state.calls[0].consentedAt, "string");
  assert.ok(!Number.isNaN(Date.parse(state.calls[0].consentedAt)));
});

test("route delegates POST persistence through the existing storage boundary", async () => {
  const routeSource = await readFile(
    new URL("../app/api/lead-magnets/access/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(routeSource, /export async function POST/);
  assert.match(routeSource, /saveCapture:\s*saveLeadMagnetCapture/);
  assert.doesNotMatch(routeSource, /accessPath|accessUrl|redirect/);
  assert.doesNotMatch(routeSource, /user-agent|x-forwarded-for|headers\(\)/i);
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`\nLead magnet contract verification passed: ${passed}/${tests.length} checks.`);
