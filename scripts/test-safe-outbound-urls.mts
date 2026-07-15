import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { scrapeCompanyWebsite } from "../lib/scraper.ts";
import {
  fetchSafeOutboundUrl,
  HTTPS_OUTBOUND_PROTOCOLS,
  normalizeCompanyUrl,
  parseOutboundUrl,
  type OutboundDnsLookup
} from "../lib/url.ts";

const PUBLIC_IPV4 = "93.184.216.34";

function lookupWith(
  records: Record<string, readonly string[]>,
  calls: string[] = []
): OutboundDnsLookup {
  return async (hostname) => {
    calls.push(hostname);
    const addresses = records[hostname];
    if (!addresses) {
      throw new Error(`No deterministic DNS record for ${hostname}`);
    }
    return addresses.map((address) => ({ address }));
  };
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function expectUnsafe(run: () => Promise<unknown>): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    assert.equal(error instanceof Error, true);
    return /outbound|dns|ip address|hostname|protocol|credentials|redirect/i.test(
      (error as Error).message
    );
  });
}

async function webhookRequest(
  url: string,
  lookup: OutboundDnsLookup,
  fetchImpl: typeof fetch
): Promise<Response> {
  return fetchSafeOutboundUrl(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    { allowedProtocols: HTTPS_OUTBOUND_PROTOCOLS, lookup, fetchImpl }
  );
}

const directBlockedUrls = [
  "http://127.0.0.1",
  "http://2130706433",
  "http://0x7f000001",
  "http://%31%32%37.0.0.1",
  "http://0177.0.0.1",
  "http://127.1",
  "http://10.0.0.1",
  "http://169.254.169.254/latest/meta-data",
  "http://192.168.1.10",
  "http://224.0.0.1",
  "http://240.0.0.1",
  "http://[::]",
  "http://[::1]",
  "http://[::ffff:127.0.0.1]",
  "http://[fc00::1]",
  "http://[fe80::1]",
  "http://[ff02::1]",
  "http://[2001:db8::1]",
  "http://localhost.",
  "http://metadata.google.internal"
];

for (const url of directBlockedUrls) {
  assert.throws(() => parseOutboundUrl(url), /outbound/i, `must block ${url}`);
}
for (const url of [
  "not a url",
  "ftp://public.example/file",
  "https://user:password@public.example/path"
]) {
  assert.throws(() => parseOutboundUrl(url), /outbound/i, `must reject ${url}`);
}
assert.throws(() => normalizeCompanyUrl("ftp://public.example/file"), /protocol/i);
assert.throws(() => normalizeCompanyUrl("https:example.com"), /malformed/i);
assert.equal(normalizeCompanyUrl("example.com/path"), "https://example.com/path");

{
  let fetchCalls = 0;
  await expectUnsafe(() =>
    webhookRequest(
      "https://2130706433/hook",
      lookupWith({}),
      async () => {
        fetchCalls += 1;
        return new Response(null, { status: 204 });
      }
    )
  );
  assert.equal(fetchCalls, 0, "webhook direct blocked IP must never reach fetch");
}

{
  let fetchCalls = 0;
  await expectUnsafe(() =>
    webhookRequest(
      "https://webhook.private.test/hook",
      lookupWith({ "webhook.private.test": ["10.12.0.4"] }),
      async () => {
        fetchCalls += 1;
        return new Response(null, { status: 204 });
      }
    )
  );
  assert.equal(fetchCalls, 0, "webhook DNS-to-private result must never reach fetch");
}

{
  let fetchCalls = 0;
  await expectUnsafe(() =>
    webhookRequest(
      "https://webhook.mixed-dns.test/hook",
      lookupWith({
        "webhook.mixed-dns.test": [PUBLIC_IPV4, "fd00::1"]
      }),
      async () => {
        fetchCalls += 1;
        return new Response(null, { status: 204 });
      }
    )
  );
  assert.equal(fetchCalls, 0, "one blocked DNS answer must reject the entire destination");
}

{
  const fetchCalls: string[] = [];
  const dnsCalls: string[] = [];
  await expectUnsafe(() =>
    webhookRequest(
      "https://webhook.public.test/hook",
      lookupWith(
        {
          "webhook.public.test": [PUBLIC_IPV4],
          "redirect.private.test": ["192.168.50.2"]
        },
        dnsCalls
      ),
      async (input, init) => {
        fetchCalls.push(String(input));
        assert.equal(init?.redirect, "manual");
        return new Response(null, {
          status: 307,
          headers: { Location: "https://redirect.private.test/internal" }
        });
      }
    )
  );
  assert.deepEqual(fetchCalls, ["https://webhook.public.test/hook"]);
  assert.deepEqual(dnsCalls, ["webhook.public.test", "redirect.private.test"]);
}

{
  const fetchCalls: Array<{ url: string; redirect: RequestRedirect | undefined }> = [];
  const response = await webhookRequest(
    "https://webhook.public.test/hook",
    lookupWith({ "webhook.public.test": [PUBLIC_IPV4] }),
    async (input, init) => {
      fetchCalls.push({ url: String(input), redirect: init?.redirect });
      return new Response(null, { status: 204 });
    }
  );
  assert.equal(response.status, 204);
  assert.deepEqual(fetchCalls, [
    { url: "https://webhook.public.test/hook", redirect: "manual" }
  ]);
}

{
  let fetchCalls = 0;
  await expectUnsafe(() =>
    webhookRequest("https://dns-failure.test/hook", lookupWith({}), async () => {
      fetchCalls += 1;
      return new Response(null, { status: 204 });
    })
  );
  assert.equal(fetchCalls, 0, "webhook DNS failure must fail closed");
}

{
  let fetchCalls = 0;
  const result = await scrapeCompanyWebsite("http://2130706433", {
    lookup: lookupWith({}),
    fetchImpl: async () => {
      fetchCalls += 1;
      return htmlResponse("should not be fetched");
    }
  });
  assert.deepEqual(result, { pages: [], rawText: "" });
  assert.equal(fetchCalls, 0, "scraper direct blocked IP must never reach fetch");
}

{
  let fetchCalls = 0;
  const result = await scrapeCompanyWebsite("https://company.private.test", {
    lookup: lookupWith({ "company.private.test": ["172.20.1.9"] }),
    fetchImpl: async () => {
      fetchCalls += 1;
      return htmlResponse("should not be fetched");
    }
  });
  assert.deepEqual(result, { pages: [], rawText: "" });
  assert.equal(fetchCalls, 0, "scraper DNS-to-private result must never reach fetch");
}

{
  const fetchCalls: string[] = [];
  const result = await scrapeCompanyWebsite("https://company.public.test", {
    lookup: lookupWith({
      "company.public.test": [PUBLIC_IPV4],
      "redirect.private.test": ["169.254.169.254"]
    }),
    fetchImpl: async (input, init) => {
      fetchCalls.push(String(input));
      assert.equal(init?.redirect, "manual");
      return new Response(null, {
        status: 302,
        headers: { Location: "http://redirect.private.test/latest/meta-data" }
      });
    }
  });
  assert.deepEqual(result, { pages: [], rawText: "" });
  assert.ok(fetchCalls.length > 0);
  assert.equal(
    fetchCalls.some((url) => url.includes("redirect.private.test")),
    false,
    "scraper must validate a redirect before fetching it"
  );
}

{
  const fetchCalls: string[] = [];
  const pageText = "Public company information and services. ".repeat(8);
  const result = await scrapeCompanyWebsite("https://company.public.test", {
    lookup: lookupWith({ "company.public.test": [PUBLIC_IPV4] }),
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      fetchCalls.push(url.toString());
      assert.equal(init?.redirect, "manual");
      return url.pathname === "/"
        ? htmlResponse(`<html><title>Public Company</title><body>${pageText}</body></html>`)
        : htmlResponse("", 404);
    }
  });
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0]?.title, "Public Company");
  assert.match(result.rawText, /Public company information/);
  assert.ok(fetchCalls.length > 0);
}

{
  let fetchCalls = 0;
  const result = await scrapeCompanyWebsite("https://dns-failure.test", {
    lookup: lookupWith({}),
    fetchImpl: async () => {
      fetchCalls += 1;
      return htmlResponse("should not be fetched");
    }
  });
  assert.deepEqual(result, { pages: [], rawText: "" });
  assert.equal(fetchCalls, 0, "scraper DNS failure must fail closed");
}

const [scraperSource, workflowSource] = await Promise.all([
  readFile(new URL("../lib/scraper.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/workflow/send/route.ts", import.meta.url), "utf8")
]);

let routeLookup: OutboundDnsLookup = lookupWith({});
let routeFetch: typeof fetch = async () => new Response(null, { status: 204 });
let routeFetchCalls: string[] = [];
const validWorkflowPayload = {
  scanId: "scan-1",
  opportunityId: "opportunity-1",
  opportunity: "Stored opportunity",
  targetOrganization: "Public agency",
  targetAccount: "Public agency",
  source: "Stored source",
  revenueMotion: "Sell to Agency",
  contactStrategy: "Procurement office",
  nextBestAction: "Review the solicitation",
  crmNote: "Server-generated CRM note",
  sourceEvidence: "Stored evidence",
  workflowPayloadReady: true,
  workflowPayloadReason: "Ready for workflow"
};
const compiledWorkflowRoute = ts.transpileModule(workflowSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const workflowModule = { exports: {} as { POST?: (request: Request) => Promise<Response> } };
const workflowRequire = (specifier: string): unknown => {
  const modules: Record<string, unknown> = {
    "next/server": {
      NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) }
    },
    "@/lib/payments/requestAccess": { hasRequestReportAccess: async () => true },
    "@/lib/reportReadiness": {
      getCompletedReportReadiness: async () => ({
        ready: true,
        profile: { company_name: "Stored company" },
        signals: [{ id: "opportunity-1" }]
      })
    },
    "@/lib/storage": {
      getScan: async () => ({ id: "scan-1", report_access: "full" }),
      getStoredOpportunitySignal: async () => ({ id: "opportunity-1" }),
      getCompanyProfile: async () => null
    },
    "@/lib/profileRefinement": { ensureProfileRefinementFields: (profile: unknown) => profile },
    "@/lib/workflowPayload": { buildWorkflowPayload: () => validWorkflowPayload },
    "@/lib/url": {
      HTTPS_OUTBOUND_PROTOCOLS,
      parseOutboundUrl,
      fetchSafeOutboundUrl: async (
        value: string | URL,
        init: RequestInit,
        options: { allowedProtocols?: typeof HTTPS_OUTBOUND_PROTOCOLS }
      ) =>
        fetchSafeOutboundUrl(value, init, {
          ...options,
          lookup: routeLookup,
          fetchImpl: async (input, fetchInit) => {
            routeFetchCalls.push(String(input));
            return routeFetch(input, fetchInit);
          }
        })
    }
  };
  if (!(specifier in modules)) {
    throw new Error(`Unexpected workflow route dependency: ${specifier}`);
  }
  return modules[specifier];
};
new Function("require", "module", "exports", compiledWorkflowRoute)(
  workflowRequire,
  workflowModule,
  workflowModule.exports
);
const workflowPost = workflowModule.exports.POST;
assert.equal(typeof workflowPost, "function");

function workflowRequest(webhookUrl: string): Request {
  return new Request("http://local.test/api/workflow/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webhookUrl, scanId: "scan-1", opportunityId: "opportunity-1" })
  });
}

async function workflowErrorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

routeFetchCalls = [];
let routeResponse = await workflowPost!(workflowRequest("https://2130706433/hook"));
assert.equal(routeResponse.status, 400);
assert.equal(await workflowErrorCode(routeResponse), "INVALID_WEBHOOK_URL");
assert.deepEqual(routeFetchCalls, []);

routeLookup = lookupWith({ "route.private.test": ["10.0.0.8"] });
routeFetchCalls = [];
routeResponse = await workflowPost!(workflowRequest("https://route.private.test/hook"));
assert.equal(routeResponse.status, 502);
assert.equal(await workflowErrorCode(routeResponse), "WEBHOOK_DELIVERY_FAILED");
assert.deepEqual(routeFetchCalls, []);

routeLookup = lookupWith({
  "route.public.test": [PUBLIC_IPV4],
  "route.redirect-private.test": ["169.254.169.254"]
});
routeFetch = async () =>
  new Response(null, {
    status: 307,
    headers: { Location: "https://route.redirect-private.test/metadata" }
  });
routeFetchCalls = [];
routeResponse = await workflowPost!(workflowRequest("https://route.public.test/hook"));
assert.equal(routeResponse.status, 502);
assert.equal(await workflowErrorCode(routeResponse), "WEBHOOK_DELIVERY_FAILED");
assert.deepEqual(routeFetchCalls, ["https://route.public.test/hook"]);

routeLookup = lookupWith({ "route.public.test": [PUBLIC_IPV4] });
routeFetch = async () => new Response(null, { status: 204 });
routeFetchCalls = [];
routeResponse = await workflowPost!(workflowRequest("https://route.public.test/hook"));
assert.equal(routeResponse.status, 200);
assert.deepEqual(routeFetchCalls, ["https://route.public.test/hook"]);

assert.match(scraperSource, /fetchSafeOutboundUrl/);
assert.match(scraperSource, /allowedProtocols: HTTP_OUTBOUND_PROTOCOLS/);
assert.match(workflowSource, /fetchSafeOutboundUrl/);
assert.match(workflowSource, /allowedProtocols: HTTPS_OUTBOUND_PROTOCOLS/);
assert.doesNotMatch(workflowSource, /await fetch\(validation\.webhookUrl/);

console.log(
  "PASS safe outbound URLs: canonical hosts, DNS, redirects, scraper, and webhook policy"
);
