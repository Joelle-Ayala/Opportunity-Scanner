import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const routeUrl = new URL(
  "../app/api/admin/scans/[id]/quality-review/route.ts",
  import.meta.url
);
const [routeSource, adminPageSource, storageSource] = await Promise.all([
  readFile(routeUrl, "utf8"),
  readFile(new URL("../app/admin/reports/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/storage.ts", import.meta.url), "utf8")
]);

assert.doesNotMatch(routeSource, /nurture|marketing/i);
assert.match(adminPageSource, /listAdminScansWithProfiles/);
assert.match(adminPageSource, /Held for human review/);
assert.match(adminPageSource, /Internal blocker summary/);
assert.match(adminPageSource, /Inspect held report/);
assert.match(adminPageSource, /name="access"/);
assert.match(adminPageSource, /Publish report/);
assert.match(adminPageSource, /Request revised scan/);
assert.match(storageSource, /status: "eq\.quality_review"/);
assert.match(storageSource, /listCompletedScans\(limit\)/);

const executableRouteSource = ts.transpileModule(routeSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

let activeState;
const mocks = {
  NextResponse: {
    json(body, init = {}) {
      return Response.json(body, init);
    },
    redirect(url, status = 307) {
      return Response.redirect(url, status);
    }
  },
  hasAdminAccess(access) {
    activeState.calls.access.push({ access });
    return activeState.hasAccess;
  },
  async getScan(id) {
    activeState.calls.getScan.push(id);
    return activeState.scan;
  },
  async resolveQualityReviewScan(id, resolution) {
    activeState.calls.resolve.push({ id, resolution });
    if (activeState.transitionConflict) return null;
    return { ...activeState.scan, ...resolution };
  },
  async deliverScanLifecycleEmailSafely(input) {
    activeState.calls.email.push(input);
    return { status: "delivered", providerMessageId: "message-1" };
  }
};

const moduleUnderTest = { exports: {} };
const routeRequire = (specifier) => {
  const modules = {
    "next/server": { NextResponse: mocks.NextResponse },
    "@/lib/access": { hasAdminAccess: mocks.hasAdminAccess },
    "@/lib/storage": {
      getScan: mocks.getScan,
      resolveQualityReviewScan: mocks.resolveQualityReviewScan
    },
    "@/lib/transactionalEmail/scanLifecycle": {
      deliverScanLifecycleEmailSafely: mocks.deliverScanLifecycleEmailSafely
    }
  };
  if (!(specifier in modules)) throw new Error(`Unexpected route dependency: ${specifier}`);
  return modules[specifier];
};
new Function("require", "module", "exports", executableRouteSource)(
  routeRequire,
  moduleUnderTest,
  moduleUnderTest.exports
);
const { POST } = moduleUnderTest.exports;
assert.equal(typeof POST, "function");

function freshState(overrides = {}) {
  return {
    scan: {
      id: "6b0b874c-32b4-4f89-a605-74ff539a9341",
      email: "customer@example.test",
      status: "quality_review",
      report_access: "free"
    },
    hasAccess: true,
    transitionConflict: false,
    calls: { access: [], getScan: [], resolve: [], email: [] },
    ...overrides
  };
}

function request(action = "publish", access = "admin-token") {
  return new Request("https://scanner.example.test/api/admin/scans/scan-1/quality-review", {
    method: "POST",
    body: new URLSearchParams({ action, access })
  });
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

activeState = freshState();
let response = await POST(request("unknown"), { params: { id: activeState.scan.id } });
assert.equal(response.status, 400);
assert.deepEqual(activeState.calls.getScan, []);

activeState = freshState({ hasAccess: false });
response = await POST(request(), { params: { id: activeState.scan.id } });
assert.equal(response.status, 403);
assert.deepEqual(activeState.calls.resolve, []);
assert.deepEqual(activeState.calls.email, []);
assert.deepEqual(activeState.calls.access, [{ access: "admin-token" }]);

for (const status of ["queued", "scraping", "profiling", "discovering", "completed", "failed"]) {
  activeState = freshState({ scan: { ...freshState().scan, status } });
  response = await POST(request(), { params: { id: activeState.scan.id } });
  assert.equal(response.status, 409, `${status} must not be resolved through human review`);
  assert.deepEqual(activeState.calls.resolve, []);
  assert.deepEqual(activeState.calls.email, []);
}

activeState = freshState();
response = await POST(request("publish"), { params: { id: activeState.scan.id } });
assert.equal(response.status, 303);
assert.equal(activeState.calls.resolve.length, 1);
const publishResolution = activeState.calls.resolve[0].resolution;
assert.equal(publishResolution.status, "completed");
assert.equal(publishResolution.error_message, null);
assert.equal(Number.isNaN(Date.parse(publishResolution.completed_at)), false);
assert.deepEqual(activeState.calls.email, [
  {
    scanId: activeState.scan.id,
    recipientEmail: activeState.scan.email,
    state: "completed"
  }
]);
assert.equal(
  response.headers.get("location"),
  "https://scanner.example.test/admin/reports?access=admin-token&resolution=published"
);

activeState = freshState();
response = await POST(request("request_revision"), { params: { id: activeState.scan.id } });
assert.equal(response.status, 303);
const revisionResolution = activeState.calls.resolve[0].resolution;
assert.equal(revisionResolution.status, "failed");
assert.match(revisionResolution.error_message, /human review/i);
assert.match(revisionResolution.error_message, /did not meet the publication bar/i);
assert.equal(Number.isNaN(Date.parse(revisionResolution.completed_at)), false);
assert.equal(activeState.calls.email[0].state, "failed");
assert.equal(
  response.headers.get("location"),
  "https://scanner.example.test/admin/reports?access=admin-token&resolution=revision_requested"
);

activeState = freshState({ transitionConflict: true });
response = await POST(request(), { params: { id: activeState.scan.id } });
assert.equal(response.status, 409);
assert.deepEqual(activeState.calls.email, []);
assert.match((await responseJson(response)).error, /no longer held/i);

console.log("Admin quality-review recovery tests passed.");
