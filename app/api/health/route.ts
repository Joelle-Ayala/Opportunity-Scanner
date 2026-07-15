import { NextResponse } from "next/server";
import { evaluateLaunchHealth } from "@/lib/launchHealth";
import { getStripeServerConfig } from "@/lib/payments/config";
import { verifyReportCatalogCached, type ReportCatalogPreflightResult } from "@/lib/payments/reportCatalogPreflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_CATALOG_HEALTH_TIMEOUT_MS = 1_500;

async function boundedReportCatalogHealthCheck(): Promise<ReportCatalogPreflightResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<ReportCatalogPreflightResult>((resolve) => {
    timeout = setTimeout(() => resolve({
      ok: false,
      code: "STRIPE_UNAVAILABLE",
      reason: "Report checkout catalog verification did not complete in time.",
      checkedAt: new Date().toISOString()
    }), REPORT_CATALOG_HEALTH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      verifyReportCatalogCached(getStripeServerConfig()),
      timeoutResult
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const configuredHealth = evaluateLaunchHealth(process.env);
  let reportCatalog: ReportCatalogPreflightResult | undefined;
  if (configuredHealth.services.payments) {
    try {
      reportCatalog = await boundedReportCatalogHealthCheck();
    } catch {
      reportCatalog = {
        ok: false,
        code: "STRIPE_UNAVAILABLE",
        reason: "Report checkout payment configuration could not be verified.",
        checkedAt: new Date().toISOString()
      };
    }
  }
  const health = evaluateLaunchHealth(process.env, reportCatalog);

  return NextResponse.json(
    {
      ...health,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local"
    },
    {
      status: health.ready.demo ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
