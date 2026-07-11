import { NextResponse } from "next/server";
import { hasServerReportAccess } from "@/lib/payments/access";
import { ensureContactEnrichmentForSignals } from "@/lib/contactEnrichment";
import {
  buildOutreachPackage,
  outreachPackageCsv,
  outreachPackageMarkdown
} from "@/lib/outreachPackage";
import { ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { getCompanyProfile, getScan, listScanOpportunitySignals } from "@/lib/storage";
import { opportunityActionFor } from "@/lib/opportunityAction";

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
  if (!(await hasServerReportAccess(access, scan))) {
    return NextResponse.json({ error: "Full report access is required to export the outreach package." }, { status: 403 });
  }

  const profileRecord = await getCompanyProfile(params.id);
  const profile = profileRecord ? ensureProfileRefinementFields(profileRecord.profile_json) : undefined;
  const signals = (await listScanOpportunitySignals(params.id))
    .filter((signal) => opportunityActionFor(signal, profile).show_in_report)
    .sort(
      (a, b) =>
        opportunityActionFor(b, profile).actionability_score -
        opportunityActionFor(a, profile).actionability_score
    );
  await ensureContactEnrichmentForSignals({
    scanId: scan.id,
    signals,
    limit: autoEnrichLimit()
  });
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
