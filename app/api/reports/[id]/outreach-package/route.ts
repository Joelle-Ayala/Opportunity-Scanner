import { NextResponse } from "next/server";
import { resolveRequestReportAccess } from "@/lib/payments/requestAccess";
import { ensureContactEnrichmentForSignals } from "@/lib/contactEnrichment";
import {
  EnrichmentCreditError,
  requireReservedEnrichmentCredit,
  reserveContactEnrichmentCredit
} from "@/lib/enrichmentCredits";
import {
  buildOutreachPackage,
  outreachPackageCsv,
  outreachPackageMarkdown
} from "@/lib/outreachPackage";
import { getScan } from "@/lib/storage";
import { opportunityActionFor } from "@/lib/opportunityAction";
import { getCompletedReportReadiness } from "@/lib/reportReadiness";

export const runtime = "nodejs";

function downloadResponse(body: string, filename: string, contentType: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

function autoEnrichLimit(): number {
  const configured = Number(process.env.OPPORTUNITY_SCANNER_AUTO_ENRICH_LIMIT ?? 5);
  if (!Number.isFinite(configured)) {
    return 5;
  }
  return Math.max(0, Math.min(10, Math.floor(configured)));
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const scan = await getScan(params.id);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const access = url.searchParams.get("access") ?? undefined;
  const reportAccess = await resolveRequestReportAccess(request.url, access, scan);
  if (!reportAccess.hasAccess) {
    return NextResponse.json({ error: "Full report access is required to export the outreach package." }, { status: 403 });
  }

  const readiness = await getCompletedReportReadiness(scan);
  if (!readiness.ready) {
    return NextResponse.json(
      { error: readiness.message, code: readiness.code },
      { status: readiness.status }
    );
  }

  const { profile } = readiness;
  const signals = readiness.signals
    .filter((signal) => opportunityActionFor(signal, profile).show_in_report)
    .sort(
      (a, b) =>
        opportunityActionFor(b, profile).actionability_score -
        opportunityActionFor(a, profile).actionability_score
    );
  try {
    await ensureContactEnrichmentForSignals({
      scanId: scan.id,
      signals,
      limit: autoEnrichLimit(),
      reserveProviderCredit: async (signal) => {
        if (!reportAccess.authUserId) {
          throw new EnrichmentCreditError({ status: "not_entitled", limit: 0, used: 0, remaining: 0 });
        }
        requireReservedEnrichmentCredit(await reserveContactEnrichmentCredit({
          authUserId: reportAccess.authUserId,
          scanId: scan.id,
          opportunityId: signal.id
        }));
      }
    });
  } catch (error) {
    // Credit exhaustion must not block export of the action data already in the paid report.
    if (!(error instanceof EnrichmentCreditError)) throw error;
  }
  const rows = await buildOutreachPackage({ scan, profile, signals });
  const format = url.searchParams.get("format") ?? "csv";
  const basename = `opportunity-outreach-package-${params.id}`;

  if (format === "json") {
    return downloadResponse(
      JSON.stringify({ scanId: scan.id, companyUrl: scan.company_url, rows }, null, 2),
      `${basename}.json`,
      "application/json; charset=utf-8"
    );
  }

  if (format === "md" || format === "markdown") {
    return downloadResponse(
      outreachPackageMarkdown(rows, scan, profile),
      `${basename}.md`,
      "text/markdown; charset=utf-8"
    );
  }

  return downloadResponse(outreachPackageCsv(rows), `${basename}.csv`, "text/csv; charset=utf-8");
}
