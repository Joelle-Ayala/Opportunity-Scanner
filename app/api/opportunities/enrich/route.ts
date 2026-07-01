import { NextResponse } from "next/server";
import { enrichContactsWithSnov } from "@/lib/connectors/snov";
import { getStoredOpportunitySignal, saveOpportunityEnrichmentRequest } from "@/lib/storage";
import { OpportunityEnrichmentType } from "@/lib/types";

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

  if (enrichmentType === "find_contacts") {
    const signal = await getStoredOpportunitySignal(scanId, opportunityId);
    const result = signal ? await enrichContactsWithSnov(signal) : null;
    await saveOpportunityEnrichmentRequest({
      scanId,
      opportunityId,
      enrichmentType,
      status: result?.status === "failed" ? "failed" : "completed",
      resultJson: result ? (result as unknown as Record<string, unknown>) : { message: "Opportunity not found." }
    });
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
