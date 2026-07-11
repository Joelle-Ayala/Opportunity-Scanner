import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeUrl = new URL("../app/api/workflow/send/route.ts", import.meta.url);
const routeSource = await readFile(routeUrl, "utf8");
const sourceWithoutImports = routeSource.replace(/^import[^\n]*\n/gm, "");
const executableRouteSource = sourceWithoutImports
  .replace(/type ValidationResult =[\s\S]*?;\ntype ValidationError = [^\n]+;\n/, "")
  .replace(
    "function jsonError(status: number, code: string, message: string)",
    "function jsonError(status, code, message)"
  )
  .replace(
    "function isObject(value: unknown): value is Record<string, unknown>",
    "function isObject(value)"
  )
  .replace(
    "function stringValue(payload: unknown, key: string): string",
    "function stringValue(payload, key)"
  )
  .replace("function isAllowedWebhookUrl(value: string): boolean", "function isAllowedWebhookUrl(value)")
  .replace("function validateRequestBody(body: unknown): ValidationResult", "function validateRequestBody(body)")
  .replace(
    "function validateWorkflowPayload(payload: WorkflowPayload): ValidationError | null",
    "function validateWorkflowPayload(payload)"
  )
  .replace("export const runtime", "const runtime")
  .replace("export async function POST(request: Request)", "async function POST(request)");

for (const typeMarker of [
  ": unknown",
  ": string",
  ": boolean",
  ": Request",
  ": ValidationResult",
  ": WorkflowPayload"
]) {
  assert.equal(
    executableRouteSource.includes(typeMarker),
    false,
    `Workflow route harness needs an update for TypeScript marker ${typeMarker}`
  );
}

const injectableSource = `
const {
  NextResponse,
  hasServerReportAccess,
  getCompanyProfile,
  getScan,
  getStoredOpportunitySignal,
  ensureProfileRefinementFields,
  buildWorkflowPayload
} = globalThis.__workflowRouteTestMocks;
${executableRouteSource}
module.exports = { POST };
`;

let activeState;
const originalFetch = globalThis.fetch;
globalThis.__workflowRouteTestMocks = {
  NextResponse: {
    json(body, init = {}) {
      return Response.json(body, init);
    }
  },
  async hasServerReportAccess(access, scan) {
    activeState.calls.access.push({ access, scan });
    return activeState.hasAccess;
  },
  async getScan(scanId) {
    activeState.calls.getScan.push(scanId);
    return activeState.scan;
  },
  async getStoredOpportunitySignal(scanId, opportunityId) {
    activeState.calls.getSignal.push({ scanId, opportunityId });
    return activeState.signal;
  },
  async getCompanyProfile(scanId) {
    activeState.calls.getProfile.push(scanId);
    return activeState.profileRecord;
  },
  ensureProfileRefinementFields(profile) {
    activeState.calls.refine.push(profile);
    return activeState.refinedProfile;
  },
  buildWorkflowPayload(input) {
    activeState.calls.build.push(input);
    return activeState.payload;
  }
};

const moduleUnderTest = { exports: {} };
new Function("module", "exports", injectableSource)(moduleUnderTest, moduleUnderTest.exports);
const { POST } = moduleUnderTest.exports;
assert.equal(typeof POST, "function", "Workflow route must export POST");

const validPayload = Object.freeze({
  scanId: "scan-1",
  opportunityId: "opportunity-1",
  opportunity: "Server-owned opportunity",
  targetOrganization: "Server-owned target",
  targetAccount: "Server-owned target",
  source: "Server-owned source",
  signalType: "Active procurement",
  revenueMotion: "Sell to Agency",
  actionability: "High Actionability",
  contactPath: "Procurement office",
  contactStrategy: "procurement_office",
  nextStep: "Review the solicitation",
  nextBestAction: "Review the solicitation",
  crmNote: "Server-generated CRM note",
  outreachAngle: "Server-generated outreach angle",
  sourceEvidence: "Server-owned evidence",
  workflowPayloadReady: true,
  workflowPayloadReason: "Ready for workflow"
});

function freshState() {
  return {
    scan: { id: "scan-1", report_access: "full" },
    signal: { id: "opportunity-1", opportunity_title: "Stored opportunity" },
    profileRecord: { profile_json: { company_name: "Stored company" } },
    refinedProfile: { company_name: "Refined stored company" },
    hasAccess: true,
    payload: { ...validPayload },
    fetchBehavior: "success",
    fetchStatus: 200,
    calls: {
      access: [],
      getScan: [],
      getSignal: [],
      getProfile: [],
      refine: [],
      build: [],
      fetch: []
    }
  };
}

function installBoundaries(state) {
  activeState = state;

  globalThis.fetch = async (url, options) => {
    state.calls.fetch.push({ url: String(url), options });
    if (state.fetchBehavior === "abort") {
      const error = new Error("Controlled timeout");
      error.name = "AbortError";
      throw error;
    }
    if (state.fetchBehavior === "throw") {
      throw new Error("Controlled delivery failure");
    }
    return new Response(null, { status: state.fetchStatus });
  };
}

function jsonRequest(body) {
  return new Request("http://local.test/api/workflow/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function validRequest(overrides = {}) {
  return jsonRequest({
    webhookUrl: "https://workflow.example.test/hooks/opportunity",
    scanId: "scan-1",
    opportunityId: "opportunity-1",
    access: "full-access-token",
    ...overrides
  });
}

async function responseBody(response) {
  return JSON.parse(await response.text());
}

async function assertError(response, status, code) {
  assert.equal(response.status, status);
  const body = await responseBody(response);
  assert.deepEqual(Object.keys(body).sort(), ["error", "ok"]);
  assert.equal(body.ok, false);
  assert.equal(typeof body.error, "object");
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

test("rejects malformed and non-object JSON with the stable error shape", async () => {
  for (const request of [
    new Request("http://local.test/api/workflow/send", { method: "POST", body: "{" }),
    jsonRequest([]),
    jsonRequest(null)
  ]) {
    const state = freshState();
    installBoundaries(state);
    await assertError(await POST(request), 400, "INVALID_JSON");
    assert.equal(state.calls.fetch.length, 0);
  }
});

test("requires a webhook URL and both server lookup identifiers", async () => {
  const cases = [
    [{ webhookUrl: "", scanId: "scan-1", opportunityId: "opportunity-1" }, "MISSING_WEBHOOK_URL"],
    [{ webhookUrl: "https://workflow.example.test/hook", scanId: "", opportunityId: "opportunity-1" }, "MISSING_WORKFLOW_TARGET"],
    [{ webhookUrl: "https://workflow.example.test/hook", scanId: "scan-1", opportunityId: "" }, "MISSING_WORKFLOW_TARGET"]
  ];

  for (const [body, code] of cases) {
    const state = freshState();
    installBoundaries(state);
    await assertError(await POST(jsonRequest(body)), 400, code);
    assert.equal(state.calls.getScan.length, 0);
    assert.equal(state.calls.fetch.length, 0);
  }
});

test("allows only HTTPS webhook URLs without embedded credentials", async () => {
  const rejectedUrls = [
    "http://workflow.example.test/hook",
    "https://user:password@workflow.example.test/hook",
    "not a URL",
    "ftp://workflow.example.test/hook"
  ];

  for (const webhookUrl of rejectedUrls) {
    const state = freshState();
    installBoundaries(state);
    await assertError(await POST(validRequest({ webhookUrl })), 400, "INVALID_WEBHOOK_URL");
    assert.equal(state.calls.getScan.length, 0);
    assert.equal(state.calls.fetch.length, 0);
  }
});

test("requires the requested scan to exist before access or opportunity lookup", async () => {
  const state = freshState();
  state.scan = null;
  installBoundaries(state);

  await assertError(await POST(validRequest()), 404, "SCAN_NOT_FOUND");
  assert.deepEqual(state.calls.getScan, ["scan-1"]);
  assert.equal(state.calls.access.length, 0);
  assert.equal(state.calls.getSignal.length, 0);
  assert.equal(state.calls.fetch.length, 0);
});

test("requires full report access against the stored scan", async () => {
  const state = freshState();
  state.hasAccess = false;
  installBoundaries(state);

  await assertError(await POST(validRequest()), 403, "FULL_REPORT_ACCESS_REQUIRED");
  assert.deepEqual(state.calls.access, [
    { access: "full-access-token", scan: state.scan }
  ]);
  assert.equal(state.calls.getSignal.length, 0);
  assert.equal(state.calls.build.length, 0);
  assert.equal(state.calls.fetch.length, 0);
});

test("looks up the opportunity within the requested scan and rejects a missing ownership match", async () => {
  const state = freshState();
  state.signal = null;
  installBoundaries(state);

  await assertError(await POST(validRequest()), 404, "OPPORTUNITY_NOT_FOUND");
  assert.deepEqual(state.calls.getSignal, [
    { scanId: "scan-1", opportunityId: "opportunity-1" }
  ]);
  assert.equal(state.calls.getProfile.length, 0);
  assert.equal(state.calls.build.length, 0);
  assert.equal(state.calls.fetch.length, 0);
});

test("reconstructs the payload from stored server data and ignores client action data", async () => {
  const state = freshState();
  installBoundaries(state);
  const request = validRequest({
    payload: { opportunity: "CLIENT FORGERY", workflowPayloadReady: true },
    opportunity: "CLIENT FORGERY",
    targetAccount: "CLIENT FORGERY",
    crmNote: "CLIENT FORGERY"
  });

  const response = await POST(request);
  assert.equal(response.status, 200);
  assert.deepEqual(await responseBody(response), {
    ok: true,
    message: "Opportunity sent to workflow."
  });
  assert.deepEqual(state.calls.getProfile, ["scan-1"]);
  assert.deepEqual(state.calls.refine, [state.profileRecord.profile_json]);
  assert.deepEqual(state.calls.build, [
    {
      scanId: "scan-1",
      signal: state.signal,
      profile: state.refinedProfile,
      includeSourceUrl: true
    }
  ]);
  assert.equal(state.calls.fetch.length, 1);
  const delivery = state.calls.fetch[0];
  assert.equal(delivery.url, "https://workflow.example.test/hooks/opportunity");
  assert.equal(delivery.options.method, "POST");
  assert.equal(delivery.options.headers["Content-Type"], "application/json");
  const deliveredBody = JSON.parse(delivery.options.body);
  assert.equal(deliveredBody.product, "Opportunity Scanner");
  assert.ok(!Number.isNaN(Date.parse(deliveredBody.sent_at)));
  assert.deepEqual(deliveredBody.opportunity, state.payload);
  assert.equal(JSON.stringify(deliveredBody).includes("CLIENT FORGERY"), false);
});

test("rejects a server-built payload missing workflow contract fields", async () => {
  const state = freshState();
  state.payload = { ...validPayload, crmNote: "" };
  installBoundaries(state);

  const body = await assertError(await POST(validRequest()), 422, "PAYLOAD_NOT_WORKFLOW_READY");
  assert.match(body.error.message, /crmNote/);
  assert.equal(state.calls.fetch.length, 0);
});

test("rejects a server-built opportunity that is not workflow ready", async () => {
  const state = freshState();
  state.payload = {
    ...validPayload,
    workflowPayloadReady: false,
    workflowPayloadReason: "Manual procurement research is still required."
  };
  installBoundaries(state);

  const body = await assertError(await POST(validRequest()), 422, "OPPORTUNITY_NOT_WORKFLOW_READY");
  assert.equal(body.error.message, "Manual procurement research is still required.");
  assert.equal(state.calls.fetch.length, 0);
});

test("rejects a server-built payload over the beta size limit", async () => {
  const state = freshState();
  state.payload = { ...validPayload, sourceEvidence: "x".repeat(26_000) };
  installBoundaries(state);

  await assertError(await POST(validRequest()), 413, "PAYLOAD_TOO_LARGE");
  assert.equal(state.calls.fetch.length, 0);
});

test("returns stable delivery errors for destination and transport failures", async () => {
  const destinationState = freshState();
  destinationState.fetchStatus = 503;
  installBoundaries(destinationState);
  const destinationBody = await assertError(
    await POST(validRequest()),
    502,
    "WEBHOOK_DELIVERY_FAILED"
  );
  assert.match(destinationBody.error.message, /503/);

  const transportState = freshState();
  transportState.fetchBehavior = "throw";
  installBoundaries(transportState);
  await assertError(await POST(validRequest()), 502, "WEBHOOK_DELIVERY_FAILED");

  const timeoutState = freshState();
  timeoutState.fetchBehavior = "abort";
  installBoundaries(timeoutState);
  await assertError(await POST(validRequest()), 504, "WEBHOOK_TIMEOUT");
});

let passed = 0;
try {
  for (const { name, run } of tests) {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`\nWorkflow contract verification passed: ${passed}/${tests.length} checks.`);
} finally {
  delete globalThis.__workflowRouteTestMocks;
  globalThis.fetch = originalFetch;
}
