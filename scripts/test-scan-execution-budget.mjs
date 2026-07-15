import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CONNECTOR_CLEANUP_GRACE_MS,
  runConnector
} from "../lib/connectors/runtime.ts";
import {
  executeScanPipeline,
  SCAN_COMPLETION_WRITE_TIMEOUT_MS,
  SCAN_CONNECTOR_STATUS_WRITE_TIMEOUT_MS,
  SCAN_POST_DISCOVERY_RESERVE_MS,
  SCAN_EXECUTION_DEADLINE_MS,
  SCAN_FUNCTION_MAX_DURATION_MS,
  SCAN_SIGNAL_WRITE_TIMEOUT_MS,
  SCAN_TERMINAL_WRITE_TIMEOUT_MS,
  scanFailureTerminalStatePersisted,
  ScanDiscoveryFailureError,
  ScanStageTimeoutError
} from "../lib/scanPipeline.ts";

const input = {
  companyUrl: "https://example.com",
  companyName: "Example",
  reportType: "quick"
};

const profile = {
  company_name: "Example",
  website: input.companyUrl,
  summary: "Example profile",
  products_services: ["workforce software"],
  target_customers: ["Education"],
  industries: ["education"],
  geographies: ["US"],
  keywords: ["teacher staffing"],
  public_sector_search_terms: ["teacher recruitment"],
  translated_public_sector_terms: ["teacher recruitment"],
  negative_keywords: [],
  possible_naics: [],
  possible_psc: [],
  possible_soc: [],
  policy_sensitive_categories: ["education_funding"],
  opportunity_lanes: ["Education workforce"],
  lane_search_terms: { "Education workforce": ["teacher recruitment"] },
  opportunity_categories: ["procurement"],
  selected_playbooks: [],
  activated_source_categories: [],
  planned_source_categories: [],
  likely_revenue_motions: [],
  suggested_contact_roles: [],
  report_guidance: []
};

function dependencies(overrides = {}) {
  return {
    updateScan: async (scanId, payload) => ({ id: scanId, ...payload }),
    scrapeCompanyWebsite: async () => ({
      pages: [{ url: input.companyUrl, title: "Example", text: "Example website text" }],
      rawText: "Example website text"
    }),
    generateCompanyProfile: async () => profile,
    listProfileFeedbackForCompanyUrl: async () => [],
    applyProfileFeedbackToProfile: (value) => value,
    saveCompanyProfile: async () => ({}),
    discoverExternalSignalsWithStatus: async () => ({ signals: [], runs: [] }),
    saveConnectorRunStatuses: async () => [],
    saveOpportunitySignals: async () => [],
    normalizeOpportunitySignals: (signals) => signals,
    evaluateReportQuality: (_profile, signals, tier) => ({
      passed: true,
      score: 100,
      blockingReasons: [],
      metrics: {
        tier,
        opportunityCount: signals.length,
        minimumOpportunityCount: 3,
        qualifyingOpportunityCount: signals.length,
        minimumQualifyingOpportunityCount: 3,
        requirementPassCounts: {},
        requirementCoverage: {}
      },
      opportunities: []
    }),
    now: Date.now,
    ...overrides
  };
}

test("the scan execution deadline stays below the Vercel function limit", () => {
  assert.ok(SCAN_EXECUTION_DEADLINE_MS < SCAN_FUNCTION_MAX_DURATION_MS);
  assert.ok(
    SCAN_EXECUTION_DEADLINE_MS + SCAN_TERMINAL_WRITE_TIMEOUT_MS <
      SCAN_FUNCTION_MAX_DURATION_MS
  );
  assert.ok(SCAN_POST_DISCOVERY_RESERVE_MS < SCAN_EXECUTION_DEADLINE_MS);
  assert.ok(DEFAULT_CONNECTOR_CLEANUP_GRACE_MS < SCAN_POST_DISCOVERY_RESERVE_MS);
  assert.ok(
    SCAN_CONNECTOR_STATUS_WRITE_TIMEOUT_MS +
      SCAN_SIGNAL_WRITE_TIMEOUT_MS +
      SCAN_COMPLETION_WRITE_TIMEOUT_MS +
      1_000 <=
      SCAN_POST_DISCOVERY_RESERVE_MS,
    "post-discovery write caps must leave bounded orchestration overhead"
  );
});

test("an already-expired deadline persists a failed terminal scan", async () => {
  const updates = [];
  const now = Date.now();

  await assert.rejects(
    executeScanPipeline("deadline-expired", input, {
      deadlineAtMs: now - 1,
      terminalDeadlineAtMs: now + 500,
      dependencies: dependencies({
        updateScan: async (scanId, payload) => {
          updates.push(payload);
          return { id: scanId, ...payload };
        }
      })
    }),
    (error) => error instanceof ScanStageTimeoutError && /starting/.test(error.message)
  );

  assert.equal(updates.at(-1)?.status, "failed");
  assert.match(updates.at(-1)?.error_message ?? "", /deadline exceeded during starting/i);
  assert.ok(updates.at(-1)?.completed_at, "failed scans must receive a terminal timestamp");
});

test("a hanging stage is aborted within its remaining budget and ends failed", async () => {
  const updates = [];
  let scrapeAborted = false;
  const now = Date.now();

  await assert.rejects(
    executeScanPipeline("stage-timeout", input, {
      deadlineAtMs: now + 35,
      terminalDeadlineAtMs: now + 500,
      dependencies: dependencies({
        updateScan: async (scanId, payload) => {
          updates.push(payload);
          return { id: scanId, ...payload };
        },
        scrapeCompanyWebsite: async (_url, budget) =>
          new Promise((_, reject) => {
            budget.signal.addEventListener(
              "abort",
              () => {
                scrapeAborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true }
            );
          })
      })
    }),
    (error) => error instanceof ScanStageTimeoutError && /scraping/.test(error.message)
  );

  assert.equal(scrapeAborted, true);
  assert.equal(updates.at(-1)?.status, "failed");
  assert.match(updates.at(-1)?.error_message ?? "", /deadline exceeded during scraping/i);
});

test("the default discovery path forwards the parent budget to every connector", async () => {
  const [pipelineSource, discoverySource] = await Promise.all([
    readFile(new URL("../lib/scanPipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors/discover.ts", import.meta.url), "utf8")
  ]);

  assert.match(
    pipelineSource,
    /discoverExternalSignalsWithStatus\(companyProfile, budget\)/
  );
  assert.match(discoverySource, /signal: budget\.signal/);
  assert.match(discoverySource, /deadlineAtMs: Number\.isFinite\(deadlineAtMs\)/);
});

test("a pipeline deadline aborts and settles hanging connector work", async () => {
  const updates = [];
  let connectorActive = false;
  let connectorObservedAbort = false;
  let connectorSettled = false;
  const now = Date.now();

  await assert.rejects(
    executeScanPipeline("connector-deadline", input, {
      deadlineAtMs: now + 50,
      terminalDeadlineAtMs: now + 500,
      postDiscoveryReserveMs: 10,
      dependencies: dependencies({
        updateScan: async (scanId, payload) => {
          updates.push(payload);
          return { id: scanId, ...payload };
        },
        discoverExternalSignalsWithStatus: async (_companyProfile, budget) => {
          const result = await runConnector({
            sourceId: "hanging-source",
            sourceName: "Hanging source",
            enabled: true,
            signal: budget.signal,
            deadlineAtMs: budget.deadlineAtMs,
            timeoutMs: 1_000,
            requestTimeoutMs: 1_000,
            nextTest: "Verify parent cancellation.",
            notes: "Focused pipeline deadline test.",
            execute: async (context) => {
              connectorActive = true;
              await new Promise((resolve) => {
                context.signal.addEventListener(
                  "abort",
                  () => {
                    connectorObservedAbort = true;
                    connectorActive = false;
                    resolve();
                  },
                  { once: true }
                );
              });
              return [];
            }
          });
          connectorSettled = true;
          return { signals: result.signals, runs: [result.run] };
        }
      })
    }),
    (error) =>
      (error instanceof ScanStageTimeoutError && /discovering/.test(error.message)) ||
      error instanceof ScanDiscoveryFailureError
  );

  assert.equal(connectorObservedAbort, true);
  assert.equal(connectorActive, false);
  assert.equal(connectorSettled, true, "pipeline must await connector settlement before returning");
  assert.equal(updates.at(-1)?.status, "failed");
});

test("mixed connector outcomes preserve usable signals and diagnostics", async () => {
  const savedRuns = [];
  const savedSignals = [];
  const updates = [];
  const signal = { opportunity_title: "Teacher recruitment platform solicitation" };
  const runs = [
    { source_name: "Grants.gov", status: "active", outcome: "matches_found" },
    { source_name: "SAM.gov", status: "failing", outcome: "failed", error_code: "timeout" }
  ];

  await executeScanPipeline("partial-results", input, {
    deadlineAtMs: Date.now() + 1_000,
    terminalDeadlineAtMs: Date.now() + 1_500,
    postDiscoveryReserveMs: 100,
    dependencies: dependencies({
      updateScan: async (scanId, payload) => {
        updates.push(payload);
        return { id: scanId, ...payload };
      },
      discoverExternalSignalsWithStatus: async () => ({ signals: [signal], runs }),
      saveConnectorRunStatuses: async (_scanId, values) => {
        savedRuns.push(...values);
        return [];
      },
      saveOpportunitySignals: async (_scanId, values) => {
        savedSignals.push(...values);
        return [];
      }
    })
  });

  assert.deepEqual(savedSignals, [signal]);
  assert.deepEqual(savedRuns, runs);
  assert.equal(updates.at(-1)?.status, "completed");
  assert.ok(updates.at(-1)?.completed_at);
});

test("near-boundary discovery leaves enough time to persist and complete", async () => {
  const updates = [];
  let currentTimeMs = 1_000;
  let discoveryDeadlineAtMs;

  await executeScanPipeline("near-boundary-success", input, {
    deadlineAtMs: 1_100,
    terminalDeadlineAtMs: 1_200,
    postDiscoveryReserveMs: 30,
    dependencies: dependencies({
      now: () => currentTimeMs,
      updateScan: async (scanId, payload) => {
        if (payload.status === "completed") currentTimeMs += 5;
        updates.push(payload);
        return { id: scanId, ...payload };
      },
      discoverExternalSignalsWithStatus: async (_companyProfile, budget) => {
        discoveryDeadlineAtMs = budget.deadlineAtMs;
        currentTimeMs = 1_068;
        return {
          signals: [],
          runs: [{ source_name: "Grants.gov", status: "active", outcome: "no_matches" }]
        };
      },
      saveConnectorRunStatuses: async () => {
        currentTimeMs += 8;
        return [];
      },
      saveOpportunitySignals: async () => {
        currentTimeMs += 8;
        return [];
      }
    })
  });

  assert.equal(discoveryDeadlineAtMs, 1_070);
  assert.equal(updates.at(-1)?.status, "completed");
  assert.ok(currentTimeMs < 1_100, "reserved persistence must finish before execution deadline");
});

test("healthy zero-match discovery completes even when other sources are skipped", async () => {
  const updates = [];

  await executeScanPipeline("healthy-zero-match", input, {
    deadlineAtMs: Date.now() + 1_000,
    terminalDeadlineAtMs: Date.now() + 1_500,
    postDiscoveryReserveMs: 100,
    dependencies: dependencies({
      updateScan: async (scanId, payload) => {
        updates.push(payload);
        return { id: scanId, ...payload };
      },
      discoverExternalSignalsWithStatus: async () => ({
        signals: [],
        runs: [
          { source_name: "USAspending.gov", status: "active", outcome: "no_matches" },
          { source_name: "SAM.gov", status: "needs_api_key", outcome: "skipped" },
          { source_name: "State/local", status: "disabled", outcome: "skipped" }
        ]
      })
    })
  });

  assert.equal(updates.at(-1)?.status, "completed");
});

test("quality gate holds a scan from completion without discarding source diagnostics", async () => {
  const updates = [];
  const savedSignals = [];
  const quality = {
    passed: false,
    score: 42,
    blockingReasons: [{ code: "INSUFFICIENT_QUALIFYING_OPPORTUNITIES", message: "Needs three qualified rows.", opportunityIndexes: [] }],
    metrics: {
      tier: "full",
      opportunityCount: 1,
      minimumOpportunityCount: 3,
      qualifyingOpportunityCount: 1,
      minimumQualifyingOpportunityCount: 3,
      requirementPassCounts: {},
      requirementCoverage: {}
    },
    opportunities: []
  };

  const result = await executeScanPipeline("quality-hold", input, {
    deadlineAtMs: Date.now() + 1_000,
    terminalDeadlineAtMs: Date.now() + 1_500,
    postDiscoveryReserveMs: 100,
    dependencies: dependencies({
      updateScan: async (_scanId, payload) => {
        updates.push(payload);
        return payload;
      },
      discoverExternalSignalsWithStatus: async () => ({
        signals: [{ opportunity_title: "One reportable row", show_in_report: true }],
        runs: [{ source_name: "USAspending.gov", status: "active", outcome: "matches_found" }]
      }),
      saveOpportunitySignals: async (_scanId, signals) => {
        savedSignals.push(...signals);
        return [];
      },
      evaluateReportQuality: () => quality
    })
  });

  assert.equal(result.status, "quality_review");
  assert.equal(result.quality, quality);
  assert.equal(savedSignals.length, 1, "held signals remain available for operator diagnosis");
  assert.equal(updates.at(-1)?.status, "quality_review");
  assert.equal(updates.at(-1)?.completed_at, null);
  assert.match(updates.at(-1)?.error_message ?? "", /QUALITY_REVIEW_REQUIRED/);
  assert.ok(!updates.some((update) => update.status === "completed"));
});

test("all attempted sources failing persists diagnostics and fails terminally", async () => {
  const updates = [];
  const savedRuns = [];
  const runs = [
    { source_name: "USAspending.gov", status: "failing", outcome: "failed" },
    { source_name: "Grants.gov", status: "failing", outcome: "failed" },
    { source_name: "SAM.gov", status: "needs_api_key", outcome: "skipped" },
    { source_name: "State/local", status: "disabled", outcome: "skipped" }
  ];

  await assert.rejects(
    executeScanPipeline("all-sources-failed", input, {
      deadlineAtMs: Date.now() + 1_000,
      terminalDeadlineAtMs: Date.now() + 1_500,
      postDiscoveryReserveMs: 100,
      dependencies: dependencies({
        updateScan: async (scanId, payload) => {
          updates.push(payload);
          return { id: scanId, ...payload };
        },
        discoverExternalSignalsWithStatus: async () => ({ signals: [], runs }),
        saveConnectorRunStatuses: async (_scanId, values) => {
          savedRuns.push(...values);
          return [];
        }
      })
    }),
    (error) =>
      error instanceof ScanDiscoveryFailureError &&
      /USAspending\.gov, Grants\.gov/.test(error.message)
  );

  assert.deepEqual(savedRuns, runs);
  assert.equal(updates.at(-1)?.status, "failed");
  assert.match(updates.at(-1)?.error_message ?? "", /all attempted opportunity sources failed/i);
});

test("authenticated scan ownership is bounded, idempotent, and non-fatal", async () => {
  const [routeSource, repositorySource] = await Promise.all([
    readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/dashboard/repository.ts", import.meta.url), "utf8")
  ]);

  assert.match(routeSource, /email: session\?\.user\.email \|\| optionalString/);
  assert.doesNotMatch(routeSource, /runCustomerLinkWithinDeadline|attachScanToCustomer|ensureCustomerAccount/);
  assert.match(routeSource, /withSupabaseRequestBudget\(\{ signal: controller\.signal, timeoutMs \}/);
  assert.match(routeSource, /\{ onConflict: "scan_id", ignoreDuplicates: true \}/);
  assert.match(routeSource, /await attemptCustomerScanOwnership\(session\.user\.id, scan\.id, terminalDeadlineAtMs\)/);
  assert.ok(
    routeSource.indexOf("await executeScanPipeline") <
      routeSource.indexOf("await attemptCustomerScanOwnership"),
    "ownership must run only after core scan success"
  );
  assert.match(repositorySource, /dashboardSelect<\{ id: string \}>\("scans", \{ select: "id", email: `eq\.\$\{email\}` \}\)/);
  assert.match(repositorySource, /ownership_kind: "claimed"/);
});

test("ordinary pipeline errors persist a clear failed terminal status", async () => {
  const updates = [];
  let pipelineError;

  await assert.rejects(
    executeScanPipeline("profile-error", input, {
      deadlineAtMs: Date.now() + 1_000,
      terminalDeadlineAtMs: Date.now() + 1_500,
      dependencies: dependencies({
        updateScan: async (scanId, payload) => {
          updates.push(payload);
          return { id: scanId, ...payload };
        },
        generateCompanyProfile: async () => {
          throw new Error("Profile provider unavailable");
        }
      })
    }),
    (error) => {
      pipelineError = error;
      return /Profile provider unavailable/.test(error.message);
    }
  );

  assert.equal(updates.at(-1)?.status, "failed");
  assert.equal(updates.at(-1)?.error_message, "Profile provider unavailable");
  assert.ok(updates.at(-1)?.completed_at);
  assert.equal(scanFailureTerminalStatePersisted(pipelineError), true);
});
