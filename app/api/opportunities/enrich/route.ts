import { NextResponse } from "next/server";
import { ensureContactEnrichment } from "@/lib/contactEnrichment";
import {
  EnrichmentCreditError,
  requireReservedEnrichmentCredit,
  reserveContactEnrichmentCredit
} from "@/lib/enrichmentCredits";
import { getScan, getStoredOpportunitySignal, saveOpportunityEnrichmentRequest } from "@/lib/storage";
import { OpportunityEnrichmentType } from "@/lib/types";
import { resolveRequestReportAccess } from "@/lib/payments/requestAccess";

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
  const reportAccess = await resolveRequestReportAccess(request.url, access, scan);
  if (!reportAccess.hasAccess) {
    return NextResponse.json({ error: "Full report access is required to enrich opportunities." }, { status: 403 });
  }

  if (enrichmentType === "find_contacts") {
    const signal = await getStoredOpportunitySignal(scanId, opportunityId);
    if (signal) {
      try {
        await ensureContactEnrichment({
          scanId,
          signal,
          reserveProviderCredit: async () => {
            if (!reportAccess.authUserId) {
              throw new EnrichmentCreditError({
                status: "not_entitled",
                limit: 0,
                used: 0,
                remaining: 0
              });
            }
            requireReservedEnrichmentCredit(await reserveContactEnrichmentCredit({
              authUserId: reportAccess.authUserId,
              scanId,
              opportunityId
            }));
          }
        });
      } catch (error) {
        if (!(error instanceof EnrichmentCreditError)) throw error;
        await saveOpportunityEnrichmentRequest({
          scanId,
          opportunityId,
          enrichmentType,
          status: "failed",
          resultJson: {
            provider: "credit-accounting",
            status: error.reservation.status,
            message: error.message,
            credits_remaining: error.reservation.remaining,
            credits_limit: error.reservation.limit,
            period_end: error.reservation.periodEnd
          }
        });
        const redirectUrl = new URL(`/opportunities/${opportunityId}`, request.url);
        redirectUrl.searchParams.set("scanId", scanId);
        redirectUrl.searchParams.set(
          "enrichment",
          error.reservation.status === "limit_reached" ? "credit_limit" : "growth_required"
        );
        if (access) redirectUrl.searchParams.set("access", access);
        return NextResponse.redirect(redirectUrl, 303);
      }
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

  const redirectUrl = new URL(`/opportunities/${opportunityId}`, request.url);
  redirectUrl.searchParams.set("scanId", scanId);
  redirectUrl.searchParams.set("enrichment", "requested");
  if (access) redirectUrl.searchParams.set("access", access);
  return NextResponse.redirect(redirectUrl, 303);
}
