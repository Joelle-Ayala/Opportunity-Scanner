import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  getCompletedReportReadiness,
  type ReportReadinessDependencies
} from "../lib/reportReadiness.ts";
import type {
  CompanyProfile,
  CompanyProfileRecord,
  ScanRecord,
  StoredOpportunitySignal
} from "../lib/types.ts";
import type {
  ReportQualityEvaluation,
  ReportQualityRequirement
} from "../lib/reportQuality.ts";

const ROOT = new URL("../", import.meta.url);

function scan(status: ScanRecord["status"]): ScanRecord {
  return {
    id: "scan-1",
    company_url: "https://example.com",
    status,
    report_type: "deep",
    created_at: "2026-07-15T00:00:00.000Z"
  };
}

const profile: CompanyProfile = {
  company_name: "Example Company",
  website: "https://example.com",
  summary: "Teacher hiring and district recruiting platform.",
  products_services: ["teacher hiring", "district recruiting"],
  target_customers: ["school districts"],
  industries: ["education workforce"],
  geographies: ["United States"],
  keywords: ["teacher hiring"],
  public_sector_search_terms: ["school district recruiting"],
  translated_public_sector_terms: [],
  negative_keywords: [],
  possible_naics: [],
  possible_psc: [],
  possible_soc: [],
  policy_sensitive_categories: [],
  opportunity_lanes: ["education workforce"],
  lane_search_terms: {},
  opportunity_categories: [],
  selected_playbooks: [],
  activated_source_categories: [],
  planned_source_categories: [],
  likely_revenue_motions: [],
  suggested_contact_roles: [],
  report_guidance: []
};

const profileRecord: CompanyProfileRecord = {
  id: "profile-1",
  scan_id: "scan-1",
  profile_json: profile,
  raw_text: "Teacher hiring and district recruiting platform.",
  scraped_pages: [],
  created_at: "2026-07-15T00:00:00.000Z"
};

const signal = { id: "opportunity-1", created_at: "2026-07-15T00:00:00.000Z" } as StoredOpportunitySignal;

const requirementValues: Record<ReportQualityRequirement, number> = {
  companyCorrectEvidence: 1,
  validSourceUrl: 1,
  concreteTargetOrganization: 1,
  validRevenueMotion: 1,
  nextActionAndContactPath: 1,
  actionability: 1,
  uniqueOpportunity: 1,
  noHtmlLeakage: 1
};

function quality(passed: boolean): ReportQualityEvaluation {
  return {
    passed,
    score: passed ? 100 : 70,
    blockingReasons: passed ? [] : [{
      code: "INSUFFICIENT_QUALIFYING_OPPORTUNITIES",
      message: "Not enough qualifying opportunities.",
      opportunityIndexes: []
    }],
    metrics: {
      tier: "full",
      opportunityCount: passed ? 3 : 1,
      minimumOpportunityCount: 3,
      qualifyingOpportunityCount: passed ? 3 : 0,
      minimumQualifyingOpportunityCount: 3,
      requirementPassCounts: requirementValues,
      requirementCoverage: requirementValues
    },
    opportunities: []
  };
}

function dependencies(overrides: Partial<ReportReadinessDependencies> = {}): ReportReadinessDependencies {
  return {
    getCompanyProfile: async () => profileRecord,
    listScanOpportunitySignals: async () => [signal],
    refineProfile: (value) => value,
    normalizeSignals: (signals) => [...signals],
    evaluateQuality: () => quality(true),
    ...overrides
  };
}

test("every non-completed scan fails closed before profile or opportunity loading", async () => {
  const statuses: ScanRecord["status"][] = [
    "queued",
    "scraping",
    "profiling",
    "discovering",
    "quality_review",
    "failed"
  ];

  for (const status of statuses) {
    let storageCalls = 0;
    const result = await getCompletedReportReadiness(scan(status), dependencies({
      getCompanyProfile: async () => {
        storageCalls += 1;
        return profileRecord;
      },
      listScanOpportunitySignals: async () => {
        storageCalls += 1;
        return [signal];
      }
    }));

    assert.equal(result.ready, false);
    if (result.ready) assert.fail("Non-completed scan unexpectedly passed readiness.");
    assert.equal(result.code, "REPORT_SCAN_NOT_COMPLETED");
    assert.equal(result.status, 409);
    assert.equal(storageCalls, 0);
  }
});

test("completed scans fail closed when the profile or full quality result is not ready", async () => {
  const missingProfile = await getCompletedReportReadiness(scan("completed"), dependencies({
    getCompanyProfile: async () => null
  }));
  assert.equal(missingProfile.ready, false);
  if (missingProfile.ready) assert.fail("Missing profile unexpectedly passed readiness.");
  assert.equal(missingProfile.code, "REPORT_PROFILE_NOT_READY");

  const qualityFailure = await getCompletedReportReadiness(scan("completed"), dependencies({
    evaluateQuality: () => quality(false)
  }));
  assert.equal(qualityFailure.ready, false);
  if (qualityFailure.ready) assert.fail("Failed quality unexpectedly passed readiness.");
  assert.equal(qualityFailure.code, "REPORT_QUALITY_NOT_PASSED");
  assert.equal(qualityFailure.quality?.passed, false);
});

test("completed quality-passed scans return the shared refined report data", async () => {
  const result = await getCompletedReportReadiness(scan("completed"), dependencies());
  assert.equal(result.ready, true);
  if (!result.ready) assert.fail("Completed quality-passed scan did not pass readiness.");
  assert.equal(result.profile, profile);
  assert.deepEqual(result.signals, [signal]);
  assert.equal(result.quality.passed, true);
});

test("all bypass surfaces invoke readiness before exposing or acting on report data", async () => {
  const paths = [
    "app/opportunities/[id]/page.tsx",
    "app/api/reports/[id]/export/route.ts",
    "app/api/reports/[id]/outreach-package/route.ts",
    "app/api/workflow/send/route.ts",
    "app/api/opportunities/enrich/route.ts"
  ];
  const sources: Record<string, string> = Object.fromEntries(await Promise.all(
    paths.map(async (path) => [path, await readFile(new URL(path, ROOT), "utf8")])
  ));

  for (const path of paths) {
    assert.match(sources[path], /getCompletedReportReadiness/);
  }

  const page = sources[paths[0]];
  assert.ok(page.indexOf("await getCompletedReportReadiness(scan)") < page.indexOf("readiness.signals.find"));
  assert.match(page, /if \(!readiness\.ready\)[\s\S]*redirect\(`\/reports\//);

  const exportRoute = sources[paths[1]];
  assert.ok(exportRoute.indexOf("await hasRequestReportAccess") < exportRoute.indexOf("await getCompletedReportReadiness"));
  assert.ok(exportRoute.indexOf("await getCompletedReportReadiness") < exportRoute.indexOf("const sortedSignals"));

  const outreachRoute = sources[paths[2]];
  assert.ok(outreachRoute.indexOf("await resolveRequestReportAccess") < outreachRoute.indexOf("await getCompletedReportReadiness"));
  assert.ok(outreachRoute.indexOf("await getCompletedReportReadiness") < outreachRoute.indexOf("await ensureContactEnrichmentForSignals"));

  const workflowRoute = sources[paths[3]];
  assert.ok(workflowRoute.indexOf("await hasRequestReportAccess") < workflowRoute.indexOf("await getCompletedReportReadiness"));
  assert.ok(workflowRoute.indexOf("await getCompletedReportReadiness") < workflowRoute.indexOf("const payload = buildWorkflowPayload"));
  assert.match(workflowRoute, /jsonError\(readiness\.status, readiness\.code, readiness\.message\)/);

  const enrichmentRoute = sources[paths[4]];
  assert.ok(enrichmentRoute.indexOf("await resolveRequestReportAccess") < enrichmentRoute.indexOf("await getCompletedReportReadiness"));
  assert.ok(enrichmentRoute.indexOf("await getCompletedReportReadiness") < enrichmentRoute.indexOf("const result = await ensureContactEnrichment"));
  assert.ok(enrichmentRoute.indexOf("await getCompletedReportReadiness") < enrichmentRoute.indexOf("await reserveContactEnrichmentCredit"));
});
