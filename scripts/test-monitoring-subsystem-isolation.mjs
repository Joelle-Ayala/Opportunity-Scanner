import assert from "node:assert/strict";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const routeSource = await readFile(
  new URL("../app/api/cron/monitoring/route.ts", import.meta.url),
  "utf8"
);

const compiledRoute = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  },
  fileName: "route.ts"
}).outputText;

const SECRET = "monitoring-test-secret-that-is-at-least-32-characters";

function activationSummary() {
  return {
    recovery: {
      claimed: 0,
      activated: 0,
      retrying: 0,
      deadLettered: 0,
      canceled: 0,
      staleClaims: 0,
      claimFailed: false,
      attemptFailed: 0,
      releaseFailed: 0
    },
    reminders: {
      configured: true,
      claimed: 0,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
      claimFailed: false,
      releaseFailed: 0
    }
  };
}

function monitoringAlert() {
  return {
    alert_id: "monitoring-alert-id",
    scan_id: "monitoring-scan-id",
    attempt_count: 1,
    recipient_email: "private@example.test"
  };
}

function deadlineAlert() {
  return {
    alert_id: "deadline-alert-id",
    scan_id: "deadline-scan-id",
    attempt_count: 1,
    recipient_email: "private@example.test"
  };
}

function loadRoute(overrides = {}) {
  const calls = [];
  const tracked = (name, implementation) => async (...args) => {
    calls.push(name);
    return implementation(...args);
  };
  const implementations = {
    processSubscriptionActivationRecoveries: async () => activationSummary(),
    claimDueMonitoredProfiles: async () => [],
    claimMonitoredProfileById: async () => [],
    enqueueDueDeadlineAlerts: async () => 0,
    claimPendingMonitoringAlerts: async () => [],
    claimPendingDeadlineAlerts: async () => [],
    sendMonitoringAlertEmail: async () => "monitoring-message-id",
    sendDeadlineAlertEmail: async () => "deadline-message-id",
    markMonitoringAlertSent: async () => undefined,
    markDeadlineAlertSent: async () => undefined,
    releaseMonitoringAlert: async () => undefined,
    releaseDeadlineAlert: async () => undefined,
    getMonitoringQueueHealth: async () => ({
      backlog_count: 0,
      leased_count: 0,
      stale_lease_count: 0,
      retrying_count: 0,
      dead_letter_count: 0
    }),
    recordMonitoringSchedulerHeartbeat: async () => undefined,
    ...overrides
  };
  const fn = (name) => tracked(name, implementations[name]);
  const noop = async () => undefined;
  const modules = {
    "node:crypto": { randomUUID, timingSafeEqual },
    "@/lib/deadlineAlerts/delivery": {
      getDeadlineEmailConfig: () => ({ apiKey: "test", fromEmail: "alerts@example.test" }),
      sendDeadlineAlertEmail: fn("sendDeadlineAlertEmail")
    },
    "@/lib/deadlineAlerts/storage": {
      claimPendingDeadlineAlerts: fn("claimPendingDeadlineAlerts"),
      enqueueDueDeadlineAlerts: fn("enqueueDueDeadlineAlerts"),
      markDeadlineAlertSent: fn("markDeadlineAlertSent"),
      releaseDeadlineAlert: fn("releaseDeadlineAlert")
    },
    "@/lib/monitoring/core": { findNewMonitoringSignals: () => [] },
    "@/lib/monitoring/delivery": {
      getMonitoringEmailConfig: () => ({ apiKey: "test", fromEmail: "alerts@example.test" }),
      sendMonitoringAlertEmail: fn("sendMonitoringAlertEmail")
    },
    "@/lib/payments/subscriptionActivationRecovery": {
      processSubscriptionActivationRecoveries: fn("processSubscriptionActivationRecoveries")
    },
    "@/lib/monitoring/storage": {
      claimPendingMonitoringAlerts: fn("claimPendingMonitoringAlerts"),
      claimDueMonitoredProfiles: fn("claimDueMonitoredProfiles"),
      claimMonitoredProfileById: fn("claimMonitoredProfileById"),
      completeMonitoringRun: noop,
      failMonitoringRun: noop,
      getMonitoringQueueHealth: fn("getMonitoringQueueHealth"),
      markMonitoringAlertSent: fn("markMonitoringAlertSent"),
      recordMonitoringSchedulerHeartbeat: fn("recordMonitoringSchedulerHeartbeat"),
      releaseMonitoringProfileClaim: async () => true,
      releaseMonitoringAlert: fn("releaseMonitoringAlert"),
      startMonitoringRun: noop
    },
    "@/lib/scanPipeline": { executeScanPipeline: noop },
    "@/lib/storage": {
      createScan: noop,
      getScan: noop,
      listScanOpportunitySignals: async () => [],
      updateScan: noop
    },
    "@/lib/types": {}
  };
  const module = { exports: {} };
  const quietConsole = { info() {}, error() {}, warn() {}, log() {} };
  const sandboxProcess = { env: { ...process.env, CRON_SECRET: SECRET } };
  const customRequire = (specifier) => {
    if (!(specifier in modules)) throw new Error(`Unexpected module import: ${specifier}`);
    return modules[specifier];
  };

  vm.runInNewContext(
    `(function (require, module, exports, Response, Request, Buffer, URL, process, console) { ${compiledRoute}\n})` +
      `(require, module, module.exports, Response, Request, Buffer, URL, process, console);`,
    {
      require: customRequire,
      module,
      Response,
      Request,
      Buffer,
      URL,
      process: sandboxProcess,
      console: quietConsole
    }
  );

  return { GET: module.exports.GET, calls };
}

function authorizedRequest() {
  return new Request("https://scanner.example.test/api/cron/monitoring", {
    headers: { authorization: `Bearer ${SECRET}` }
  });
}

test("green path returns 200 with healthy transport and subsystem statuses", async () => {
  const { GET, calls } = loadRoute();
  const response = await GET(authorizedRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.transportOk, true);
  assert.equal(body.transportStatus, 200);
  assert.equal(body.diagnosticStatus, 200);
  assert.equal(body.state, "healthy");
  assert.equal(body.outcome, "completed");
  assert.ok(Object.values(body.subsystems).every(({ status }) => status === "ok"));
  assert.ok(calls.includes("recordMonitoringSchedulerHeartbeat"));
});

const failures = [
  {
    name: "subscription activation",
    override: { processSubscriptionActivationRecoveries: async () => { throw new Error("activation failed"); } },
    subsystem: "subscriptionActivation",
    laterCall: "enqueueDueDeadlineAlerts"
  },
  {
    name: "profile claiming",
    override: { claimDueMonitoredProfiles: async () => { throw new Error("profile claim failed"); } },
    subsystem: "profileClaiming",
    laterCall: "enqueueDueDeadlineAlerts"
  },
  {
    name: "monitoring alert claiming",
    override: { claimPendingMonitoringAlerts: async () => { throw new Error("monitoring claim failed"); } },
    subsystem: "monitoringAlertClaiming",
    laterCall: "claimPendingDeadlineAlerts"
  },
  {
    name: "monitoring alert delivery",
    override: {
      claimPendingMonitoringAlerts: async () => [monitoringAlert()],
      sendMonitoringAlertEmail: async () => { throw new Error("monitoring delivery failed"); }
    },
    subsystem: "monitoringAlertDelivery",
    laterCall: "claimPendingDeadlineAlerts"
  },
  {
    name: "deadline enqueue",
    override: { enqueueDueDeadlineAlerts: async () => { throw new Error("deadline enqueue failed"); } },
    subsystem: "deadlineEnqueue",
    laterCall: "claimPendingMonitoringAlerts"
  },
  {
    name: "deadline alert claiming",
    override: { claimPendingDeadlineAlerts: async () => { throw new Error("deadline claim failed"); } },
    subsystem: "deadlineAlertClaiming",
    laterCall: "getMonitoringQueueHealth"
  },
  {
    name: "deadline alert delivery",
    override: {
      claimPendingDeadlineAlerts: async () => [deadlineAlert()],
      sendDeadlineAlertEmail: async () => { throw new Error("deadline delivery failed"); }
    },
    subsystem: "deadlineAlertDelivery",
    laterCall: "getMonitoringQueueHealth"
  },
  {
    name: "queue health",
    override: { getMonitoringQueueHealth: async () => { throw new Error("queue health failed"); } },
    subsystem: "queueHealth",
    laterCall: "recordMonitoringSchedulerHeartbeat"
  }
];

for (const scenario of failures) {
  test(`${scenario.name} failure is isolated and reported as degraded over HTTP 200`, async () => {
    const { GET, calls } = loadRoute(scenario.override);
    const response = await GET(authorizedRequest());
    const responseText = await response.text();
    const body = JSON.parse(responseText);

    assert.equal(response.status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.transportOk, true);
    assert.equal(body.transportStatus, 200);
    assert.ok(body.diagnosticStatus >= 500);
    assert.equal(body.state, "degraded");
    assert.equal(body.subsystems[scenario.subsystem].status, "degraded");
    assert.ok(calls.includes(scenario.laterCall), `${scenario.laterCall} should still run`);
    assert.ok(calls.includes("recordMonitoringSchedulerHeartbeat"));
    assert.doesNotMatch(responseText, /private@example\.test/);
  });
}

test("unauthorized requests remain 401 and execute no subsystem", async () => {
  const { GET, calls } = loadRoute();
  const response = await GET(new Request("https://scanner.example.test/api/cron/monitoring"));

  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
});
