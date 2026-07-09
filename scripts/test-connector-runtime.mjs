import assert from "node:assert/strict";

const {
  fetchConnectorJson,
  runConnector,
  sanitizeConnectorError
} = await import("../lib/connectors/runtime.ts");

const originalFetch = globalThis.fetch;

function options(overrides = {}) {
  return {
    sourceId: "test-source",
    sourceName: "Test Source",
    enabled: true,
    nextTest: "Run the focused connector test.",
    notes: "Test connector.",
    timeoutMs: 100,
    requestTimeoutMs: 40,
    execute: async () => [],
    ...overrides
  };
}

try {
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
  const noMatches = await runConnector(
    options({
      execute: async (context) => {
        await fetchConnectorJson(context, "Test Source", "https://example.test/data", {}, "teacher recruitment");
        return [];
      }
    })
  );
  assert.equal(noMatches.run.status, "active");
  assert.equal(noMatches.run.outcome, "no_matches");
  assert.equal(noMatches.run.request_count, 1);
  assert.equal(noMatches.run.partial_failure_count, 0);

  globalThis.fetch = async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
  const failed = await runConnector(
    options({
      execute: async (context) => {
        try {
          await fetchConnectorJson(context, "Test Source", "https://example.test/data?api_key=secret", {}, "live music");
        } catch {
          // Real connectors continue so other queries can still succeed.
        }
        return [];
      }
    })
  );
  assert.equal(failed.run.status, "failing");
  assert.equal(failed.run.outcome, "failed");
  assert.equal(failed.run.error_code, "http_error");
  assert.equal(failed.run.result_count, 0);
  assert.doesNotMatch(failed.run.error_message ?? "", /secret|api_key/i);

  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    return request === 1
      ? new Response(JSON.stringify({ results: [{}] }), { status: 200 })
      : new Response(JSON.stringify({ error: "temporary" }), { status: 502 });
  };
  const partial = await runConnector(
    options({
      execute: async (context) => {
        await fetchConnectorJson(context, "Test Source", "https://example.test/one", {}, "durable medical equipment");
        try {
          await fetchConnectorJson(context, "Test Source", "https://example.test/two", {}, "durable medical equipment");
        } catch {
          // Preserve the first usable result and expose the partial failure.
        }
        return [{ actionability: "yes" }];
      }
    })
  );
  assert.equal(partial.run.status, "active");
  assert.equal(partial.run.outcome, "matches_found");
  assert.equal(partial.run.result_count, 1);
  assert.equal(partial.run.actionable_count, 1);
  assert.equal(partial.run.partial_failure_count, 1);

  globalThis.fetch = (_input, init = {}) =>
    new Promise((_, reject) => {
      init.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true }
      );
    });
  const requestTimeout = await runConnector(
    options({
      requestTimeoutMs: 10,
      timeoutMs: 80,
      execute: async (context) => {
        try {
          await fetchConnectorJson(context, "Test Source", "https://example.test/slow", {}, "arts education");
        } catch {
          // Runtime diagnostics should turn the timeout into a failing status.
        }
        return [];
      }
    })
  );
  assert.equal(requestTimeout.run.status, "failing");
  assert.equal(requestTimeout.run.error_code, "timeout");

  const connectorTimeout = await runConnector(
    options({
      timeoutMs: 10,
      execute: async () => new Promise(() => {})
    })
  );
  assert.equal(connectorTimeout.run.status, "failing");
  assert.equal(connectorTimeout.run.outcome, "failed");
  assert.equal(connectorTimeout.run.error_code, "timeout");

  let missingKeyExecuted = false;
  const missingKey = await runConnector(
    options({
      sourceId: "sam.gov",
      sourceName: "SAM.gov",
      credentialRequired: true,
      credentialConfigured: false,
      execute: async () => {
        missingKeyExecuted = true;
        return [];
      }
    })
  );
  assert.equal(missingKey.run.status, "needs_api_key");
  assert.equal(missingKey.run.outcome, "skipped");
  assert.equal(missingKeyExecuted, false);

  const resilient = await Promise.all([
    runConnector(options({ execute: async () => [{ actionability: "maybe" }] })),
    runConnector(options({ timeoutMs: 10, execute: async () => new Promise(() => {}) }))
  ]);
  assert.equal(resilient[0].signals.length, 1);
  assert.equal(resilient[1].signals.length, 0);
  assert.equal(resilient[1].run.status, "failing");

  const sanitized = sanitizeConnectorError(
    "Request failed https://api.sam.gov/opportunities?api_key=supersecret&limit=1 Authorization=BearerSecret"
  );
  assert.doesNotMatch(sanitized, /supersecret|BearerSecret/);
  assert.match(sanitized, /redacted/i);

  console.log("PASS connector runtime: no matches remain distinct from failures");
  console.log("PASS connector runtime: partial failures preserve usable results");
  console.log("PASS connector runtime: request and connector timeouts are bounded");
  console.log("PASS connector runtime: missing credentials skip safely and errors are sanitized");
} finally {
  globalThis.fetch = originalFetch;
}
