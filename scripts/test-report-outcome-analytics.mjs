import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const [componentSource, reportPageSource] = await Promise.all([
  readFile(new URL("../components/page-analytics.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8")
]);
assert.match(
  reportPageSource,
  /<ReportAnalytics[\s\S]*?scanId=\{scan\.id\}[\s\S]*?status=\{scan\.status\}/,
  "The report must pass the authoritative stored scan status to analytics"
);
const compiledComponent = ts.transpileModule(componentSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: "page-analytics.tsx"
}).outputText;

function renderReportAnalytics(overrides = {}) {
  const events = [];
  const sessionStorage = new Map();
  const module = { exports: {} };

  const require = (specifier) => {
    if (specifier === "react") {
      return { useEffect: (effect) => effect() };
    }
    if (specifier === "@/lib/productAnalytics") {
      return {
        scanDurationBucket: () => "30-89_seconds",
        signalCountBucket: () => "4-10",
        trackProductEvent: (name, properties) => events.push({ name, properties })
      };
    }
    throw new Error(`Unexpected component dependency: ${specifier}`);
  };

  vm.runInNewContext(compiledComponent, {
    exports: module.exports,
    module,
    require,
    window: {
      sessionStorage: {
        getItem: (key) => sessionStorage.get(key) ?? null,
        setItem: (key, value) => sessionStorage.set(key, value)
      }
    }
  });

  const props = {
    scanId: "scan-analytics-test",
    status: "completed",
    tier: "free",
    signalCount: 6,
    createdAt: "2026-07-14T12:00:00.000Z",
    completedAt: "2026-07-14T12:01:00.000Z",
    ...overrides
  };
  module.exports.ReportAnalytics(props);

  return { events, renderAgain: () => module.exports.ReportAnalytics(props) };
}

const completed = renderReportAnalytics({ status: "completed" });
assert.deepEqual(JSON.parse(JSON.stringify(completed.events)), [
  {
    name: "scan_viewed",
    properties: { report_tier: "free", signal_count_bucket: "4-10" }
  },
  {
    name: "scan_completed",
    properties: {
      outcome: "success",
      signal_count_bucket: "4-10",
      duration_bucket: "30-89_seconds"
    }
  }
]);
completed.renderAgain();
assert.equal(
  completed.events.filter((event) => event.name === "scan_completed").length,
  1,
  "Completed outcome must remain session-deduplicated"
);
assert.equal(
  completed.events.filter((event) => event.name === "scan_viewed").length,
  2,
  "Report views must remain instrumented"
);

const failed = renderReportAnalytics({ status: "failed", completedAt: null });
assert.deepEqual(failed.events.map((event) => [event.name, event.properties.outcome]), [
  ["scan_viewed", undefined],
  ["scan_completed", "error"]
]);

for (const status of ["queued", "scraping", "profiling", "discovering"]) {
  const pending = renderReportAnalytics({ status, completedAt: null });
  assert.deepEqual(
    pending.events.map((event) => event.name),
    ["scan_viewed"],
    `${status} views must not emit a completion outcome`
  );
}

const legacyCompletedReport = renderReportAnalytics({ status: undefined });
assert.equal(
  legacyCompletedReport.events.at(-1)?.properties.outcome,
  "success",
  "The existing completed-report caller must preserve completion analytics"
);

const unknownPendingReport = renderReportAnalytics({ status: undefined, completedAt: null });
assert.deepEqual(
  unknownPendingReport.events.map((event) => event.name),
  ["scan_viewed"],
  "A view without authoritative completion evidence must not emit success"
);

console.log("Report outcome analytics tests passed.");
