import { NextResponse } from "next/server";
import { ensureContactEnrichment } from "@/lib/contactEnrichment";
import { getScan, getStoredOpportunitySignal, saveOpportunityEnrichmentRequest } from "@/lib/storage";
import { OpportunityEnrichmentType } from "@/lib/types";
import { hasServerReportAccess } from "@/lib/payments/access";

export const runtime = "nodejs";

const enrichmentTypes: OpportunityEnrichmentType[] = [
  "find_contacts",
  "find_similar_awards",
  "search_active_bids",
  "search_grants",
  "find_buyer_website",
  "generate_outreach"
];

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const opportunityId = String(form.get("opportunityId") || "");
  const enrichmentType = String(form.get("enrichmentType") || "") as OpportunityEnrichmentType;

  if (!scanId || !opportunityId || !enrichmentTypes.includes(enrichmentType)) {
    return NextResponse.json({ error: "Invalid enrichment request." }, { status: 400 });
  }

  const scan = await getScan(scanId);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const access = String(form.get("access") || "") || undefined;
  if (!(await hasServerReportAccess(access, scan))) {
    return NextResponse.json({ error: "Full report access is required to enrich opportunities." }, { status: 403 });
  }

  if (enrichmentType === "find_contacts") {
    const signal = await getStoredOpportunitySignal(scanId, opportunityId);
    if (signal) {
      await ensureContactEnrichment({ scanId, signal });
    } else {
      await saveOpportunityEnrichmentRequest({
        scanId,
        opportunityId,
        enrichmentType,
        status: "failed",
        resultJson: { message: "Opportunity not found." }
      });
    }
  } else {
    await saveOpportunityEnrichmentRequest({
      scanId,
      opportunityId,
      enrichmentType
    });
  }

  return NextResponse.redirect(
    new URL(`/opportunities/${opportunityId}?scanId=${scanId}&enrichment=requested`, request.url),
    303
  );
}
