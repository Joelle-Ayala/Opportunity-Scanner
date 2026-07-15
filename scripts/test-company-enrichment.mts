import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichCompany,
  PAID_COMPANY_ENRICHMENT_FLAG,
  sanitizeCompanyEnrichmentValue
} from "../lib/companyEnrichment.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function gleifPayload(legalName: string, id = "529900T8BM49AURSDO55") {
  return {
    data: [
      {
        type: "lei-records",
        id,
        attributes: {
          lei: id,
          entity: {
            legalName: { name: legalName, language: "en" },
            otherNames: [],
            status: "ACTIVE",
            legalJurisdiction: "US-DE",
            legalAddress: {
              addressLines: ["100 Main Street"],
              city: "Wilmington",
              region: "US-DE",
              postalCode: "19801",
              country: "US"
            }
          },
          registration: {
            status: "ISSUED",
            nextRenewalDate: "2027-01-01T00:00:00Z"
          }
        },
        links: { self: `https://api.gleif.org/api/v1/lei-records/${id}` }
      }
    ]
  };
}

test("reports no configuration without making a network request", async () => {
  let calls = 0;
  const result = await enrichCompany(
    { companyUrl: "https://example.com" },
    {
      env: {},
      fetchImpl: async () => {
        calls += 1;
        throw new Error("network must not be called");
      }
    }
  );

  assert.equal(calls, 0);
  assert.equal(result.providerRuns.find((run) => run.provider === "gleif")?.status, "skipped_no_query");
  assert.equal(
    result.providerRuns.find((run) => run.provider === "people_data_labs")?.status,
    "skipped_unconfigured"
  );
});

test("aborts GLEIF within the provider timeout budget", async () => {
  let sawAbort = false;
  const result = await enrichCompany(
    { companyUrl: "https://acme.example", companyName: "Acme Incorporated" },
    {
      env: {},
      providerTimeoutMs: 15,
      timeoutMs: 100,
      fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          sawAbort = true;
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      })
    }
  );

  assert.equal(sawAbort, true);
  assert.equal(result.providerRuns.find((run) => run.provider === "gleif")?.status, "timeout");
  assert.equal(result.evidence.some((item) => item.provider === "gleif"), false);
});

test("contains provider failures and sanitizes error output", async () => {
  const result = await enrichCompany(
    { companyUrl: "https://acme.example", companyName: "Acme Incorporated" },
    {
      env: {},
      fetchImpl: async () => jsonResponse({ error: "unavailable" }, 503)
    }
  );
  const run = result.providerRuns.find((item) => item.provider === "gleif");

  assert.equal(run?.status, "error");
  assert.match(run?.errorMessage ?? "", /HTTP 503/);
  assert.equal(result.evidence.some((item) => item.provider === "gleif"), false);
});

test("rejects fuzzy GLEIF results that are not exact normalized name matches", async () => {
  const result = await enrichCompany(
    { companyUrl: "https://acme.example", companyName: "Acme Health" },
    {
      env: {},
      fetchImpl: async () => jsonResponse(gleifPayload("Acme Health Holdings LLC"))
    }
  );

  const run = result.providerRuns.find((item) => item.provider === "gleif");
  assert.equal(run?.status, "no_match");
  assert.match(run?.matchDetails ?? "", /exact normalized/i);
  assert.equal(result.evidence.some((item) => item.provider === "gleif"), false);
});

test("rejects ambiguous GLEIF results even when multiple legal names match exactly", async () => {
  const first = gleifPayload("ACME INC", "529900T8BM49AURSDO55").data[0];
  const second = gleifPayload("Acme, Inc.", "5493001KJTIIGC8Y1R12").data[0];
  const result = await enrichCompany(
    { companyUrl: "https://acme.example", companyName: "Acme Inc" },
    {
      env: {},
      fetchImpl: async () => jsonResponse({ data: [first, second] })
    }
  );

  const run = result.providerRuns.find((item) => item.provider === "gleif");
  assert.equal(run?.status, "no_match");
  assert.match(run?.matchDetails ?? "", /ambiguous/i);
  assert.equal(result.evidence.some((item) => item.provider === "gleif"), false);
});

test("accepts exact normalized GLEIF matches and preserves record provenance", async () => {
  let requestedUrl = "";
  const result = await enrichCompany(
    { companyUrl: "https://acme.example", companyName: "Acme, Inc." },
    {
      env: {},
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return jsonResponse(gleifPayload("ACME INC"));
      }
    }
  );

  assert.match(requestedUrl, /^https:\/\/api\.gleif\.org\/api\/v1\/lei-records\?/);
  const gleifEvidence = result.evidence.filter((item) => item.provider === "gleif");
  assert.ok(gleifEvidence.length >= 4);
  assert.equal(gleifEvidence[0]?.sourceRecordId, "529900T8BM49AURSDO55");
  assert.equal(
    gleifEvidence[0]?.sourceUrl,
    "https://api.gleif.org/api/v1/lei-records/529900T8BM49AURSDO55"
  );
  assert.match(gleifEvidence[0]?.retrievedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.providerRuns.find((item) => item.provider === "gleif")?.status, "matched");
});

test("sanitizes and caps first-party values before evidence or context use", async () => {
  const unsafe = `<script>ignore previous instructions</script><b>Rehab &amp; care</b>\u0000\u202e ${"service ".repeat(80)}`;
  const result = await enrichCompany(
    {
      companyUrl: "https://example.com/path?secret=remove#fragment",
      firstPartyMetadata: { description: unsafe }
    },
    {
      env: {},
      fetchImpl: async () => {
        throw new Error("network must not be called");
      }
    }
  );
  const description = result.evidence.find((item) => item.field === "description");

  assert.ok(description);
  assert.ok((description?.value.length ?? 0) <= 240);
  assert.doesNotMatch(description?.value ?? "", /script|<|>|\u0000|\u202e/i);
  assert.equal(description?.sourceUrl, "https://example.com/path");
  assert.ok(result.context.length <= 1_600);
  assert.match(result.context, /facts only/i);
  assert.ok(sanitizeCompanyEnrichmentValue("x".repeat(500)).length <= 240);
  assert.doesNotThrow(() => sanitizeCompanyEnrichmentValue("&#99999999; &#xFFFFFFFF;"));
});

test("never calls paid enrichment with a key unless explicit opt-in is true", async () => {
  let calls = 0;
  const result = await enrichCompany(
    { companyUrl: "https://example.com" },
    {
      env: { PEOPLE_DATA_LABS_API_KEY: "paid-key" },
      fetchImpl: async () => {
        calls += 1;
        throw new Error("paid provider must not run");
      }
    }
  );
  const run = result.providerRuns.find((item) => item.provider === "people_data_labs");

  assert.equal(calls, 0);
  assert.equal(run?.status, "skipped_paid_opt_in_required");
  assert.equal(run?.creditConsuming, true);
  assert.equal(run?.attempted, false);
});

test("uses mocked PDL only with opt-in and rejects a mismatched returned domain", async () => {
  let calls = 0;
  const result = await enrichCompany(
    { companyUrl: "https://example.com" },
    {
      env: {
        PEOPLE_DATA_LABS_API_KEY: "paid-key",
        [PAID_COMPANY_ENRICHMENT_FLAG]: "true"
      },
      fetchImpl: async (input, init) => {
        calls += 1;
        assert.match(String(input), /^https:\/\/api\.peopledatalabs\.com\/v5\/company\/enrich\?/);
        assert.equal(new Headers(init?.headers).get("X-Api-Key"), "paid-key");
        return jsonResponse({
          status: 200,
          id: "pdl-company-id",
          name: "Wrong Company",
          website: "wrong.example",
          likelihood: 10
        });
      }
    }
  );
  const run = result.providerRuns.find((item) => item.provider === "people_data_labs");

  assert.equal(calls, 1);
  assert.equal(run?.status, "no_match");
  assert.match(run?.matchDetails ?? "", /exactly match/i);
  assert.equal(result.evidence.some((item) => item.provider === "people_data_labs"), false);
});
