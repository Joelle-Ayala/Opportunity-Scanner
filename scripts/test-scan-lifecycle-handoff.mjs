import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const routeSource = await readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8");
const testableRouteSource = `${routeSource}\nexport { attemptCompletedScanNurture };\n`;
const transpiledRoute = ts.transpileModule(testableRouteSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const routeModule = { exports: {} };
vm.runInNewContext(transpiledRoute, {
  AbortController,
  Date,
  DOMException,
  FormData,
  Promise,
  Response,
  URL,
  clearTimeout,
  console,
  exports: routeModule.exports,
  module: routeModule,
  require: () => ({}),
  setTimeout
});
const { attemptCompletedScanNurture } = routeModule.exports;
const scanId = "d8f11e5e-0802-4df2-aa4a-52c853905be7";

function recordingLogger() {
  const entries = [];
  return {
    entries,
    logger: {
      info(message, fields) {
        entries.push({ level: "info", message, fields });
      },
      error(message, fields) {
        entries.push({ level: "error", message, fields });
      }
    }
  };
}

test("consented completed scan durably enqueues with an independent request budget", async () => {
  const calls = [];
  const logs = recordingLogger();
  const result = await attemptCompletedScanNurture(
    {
      scanId,
      email: "customer@example.test",
      companyName: "Example Co",
      marketingConsent: true
    },
    {
      now: () => Date.parse("2026-08-05T15:00:00.000Z"),
      logger: logs.logger,
      withBudget: async (budget, operation) => {
        calls.push({ budget });
        return operation();
      },
      enqueue: async (input) => {
        calls.push({ input });
        return {
          enrollment_id: "enrollment-1",
          subscriber_id: "subscriber-1",
          subscriber_status: "subscribed",
          queued_count: 5
        };
      }
    }
  );

  assert.equal(result, "enqueued");
  assert.equal(calls[0].budget.timeoutMs, 1_500);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].input)), {
    scanId,
    email: "customer@example.test",
    companyName: "Example Co",
    consentedAt: "2026-08-05T15:00:00.000Z",
    consentSource: "homepage_scan"
  });
  assert.equal(logs.entries.at(-1)?.fields.event, "scan.nurture.enqueued");
});

test("consent false emits a privacy-safe skip and never calls storage", async () => {
  const logs = recordingLogger();
  const result = await attemptCompletedScanNurture(
    {
      scanId,
      email: "private@example.test",
      companyName: "Private Company",
      marketingConsent: false
    },
    {
      logger: logs.logger,
      enqueue: async () => {
        throw new Error("enqueue must not run");
      }
    }
  );

  assert.equal(result, "skipped");
  assert.deepEqual(JSON.parse(JSON.stringify(logs.entries)), [{
    level: "info",
    message: "Scan nurture enrollment skipped",
    fields: {
      event: "scan.nurture.skipped",
      scanId,
      reason: "marketing_consent_not_granted"
    }
  }]);
  assert.doesNotMatch(JSON.stringify(logs.entries), /private@example|Private Company/);
});

test("nurture still enqueues after the scan terminal budget is exhausted", async () => {
  const pipelineCall = routeSource.indexOf("await executeScanPipeline");
  const nurtureCall = routeSource.indexOf("await attemptCompletedScanNurture", pipelineCall);
  const finalizers = routeSource.indexOf("await Promise.all", nurtureCall);
  let enqueueCount = 0;

  const result = await attemptCompletedScanNurture(
    { scanId, email: "customer@example.test", marketingConsent: true },
    {
      now: () => Date.parse("2026-08-05T15:00:56.000Z"),
      withBudget: async (_budget, operation) => operation(),
      enqueue: async () => {
        enqueueCount += 1;
        return {
          enrollment_id: "enrollment-2",
          subscriber_id: "subscriber-2",
          subscriber_status: "subscribed",
          queued_count: 5
        };
      },
      logger: recordingLogger().logger
    }
  );

  assert.equal(result, "enqueued");
  assert.equal(enqueueCount, 1);
  assert.ok(pipelineCall >= 0 && nurtureCall > pipelineCall && finalizers > nurtureCall);
  assert.doesNotMatch(routeSource, /nurtureTimeoutMs|terminalDeadlineAtMs - Date\.now\(\)/);
});

test("enrollment failure has a distinct event and does not throw into scan completion", async () => {
  const logs = recordingLogger();
  const result = await attemptCompletedScanNurture(
    { scanId, email: "customer@example.test", marketingConsent: true },
    {
      logger: logs.logger,
      withBudget: async (_budget, operation) => operation(),
      enqueue: async () => {
        throw new Error("storage unavailable");
      }
    }
  );

  assert.equal(result, "failed");
  assert.equal(logs.entries[0].level, "error");
  assert.equal(logs.entries[0].fields.event, "scan.nurture.enrollment_failed");
  assert.equal(logs.entries[0].fields.scanId, scanId);
});
