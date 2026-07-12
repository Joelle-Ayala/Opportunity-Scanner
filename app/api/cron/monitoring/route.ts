import { timingSafeEqual } from "node:crypto";
import { findNewMonitoringSignals } from "@/lib/monitoring/core";
import {
  claimDueMonitoredProfiles,
  completeMonitoringRun,
  failMonitoringRun,
  startMonitoringRun,
  type MonitoringRunRecord
} from "@/lib/monitoring/storage";
import { executeScanPipeline } from "@/lib/scanPipeline";
import {
  createScan,
  getScan,
  listScanOpportunitySignals,
  updateScan
} from "@/lib/storage";
import type { ScanInput, ScanRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function scanInputFromRecord(scan: ScanRecord): ScanInput {
  return {
    companyUrl: scan.company_url,
    companyName: scan.company_name || undefined,
    headquartersState: scan.headquarters_state || undefined,
    targetStates: scan.target_states || undefined,
    industry: scan.industry || undefined,
    customerType: scan.customer_type as ScanInput["customerType"],
    email: scan.email || undefined,
    reportType: scan.report_type,
    opportunityFocus: scan.opportunity_focus || undefined,
    includeTerms: scan.include_terms || undefined,
    excludeTerms: scan.exclude_terms || undefined,
    prioritySignals: scan.priority_signals || []
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let profiles;
  try {
    profiles = await claimDueMonitoredProfiles(1);
  } catch {
    return Response.json(
      { ok: false, error: "Monitoring storage is unavailable." },
      { status: 503 }
    );
  }

  const results: Array<{ profileId: string; status: "completed" | "failed"; newCount?: number }> = [];

  for (const profile of profiles) {
    let scanId: string | null = null;
    let run: MonitoringRunRecord | null = null;

    try {
      const previousScanId = profile.latest_scan_id || profile.source_scan_id;
      const baselineScan = await getScan(previousScanId);
      if (!baselineScan || baselineScan.status !== "completed") {
        throw new Error("The saved profile does not have a completed baseline scan.");
      }

      const input = scanInputFromRecord(baselineScan);
      const scan = await createScan(input);
      scanId = scan.id;
      run = await startMonitoringRun(profile.id, scan.id);
      await executeScanPipeline(scan.id, input);

      const [previousSignals, currentSignals] = await Promise.all([
        listScanOpportunitySignals(previousScanId),
        listScanOpportunitySignals(scan.id)
      ]);
      const newSignals = findNewMonitoringSignals(previousSignals, currentSignals);

      await completeMonitoringRun({ profile, run, scanId: scan.id, newSignals });
      results.push({ profileId: profile.id, status: "completed", newCount: newSignals.length });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Monitoring run failed.";
      if (scanId) {
        await updateScan(scanId, { status: "failed", error_message: message }).catch(() => undefined);
      }
      await failMonitoringRun({ profile, run, message }).catch(() => undefined);
      results.push({ profileId: profile.id, status: "failed" });
    }
  }

  return Response.json({
    ok: true,
    claimed: profiles.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results
  });
}
