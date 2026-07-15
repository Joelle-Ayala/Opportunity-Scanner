import { NextResponse } from "next/server";
import { ensureContactEnrichment } from "@/lib/contactEnrichment";
import {
  EnrichmentCreditError,
  requireReservedEnrichmentCredit,
  reserveContactEnrichmentCredit
} from "@/lib/enrichmentCredits";
import { getScan, saveOpportunityEnrichmentRequest } from "@/lib/storage";
import { resolveRequestReportAccess } from "@/lib/payments/requestAccess";
import { getCompletedReportReadiness } from "@/lib/reportReadiness";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const opportunityId = String(form.get("opportunityId") || "");
  const enrichmentType = String(form.get("enrichmentType") || "");

  if (!scanId || !opportunityId) {
    return NextResponse.json({ error: "Invalid enrichment request." }, { status: 400 });
  }
  if (enrichmentType !== "find_contacts") {
    return NextResponse.json({ error: "This enrichment action is not available." }, { status: 400 });
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

  const readiness = await getCompletedReportReadiness(scan);
  if (!readiness.ready) {
    return NextResponse.json(
      { error: readiness.message, code: readiness.code },
      { status: readiness.status }
    );
  }

  const signal = readiness.signals.find((item) => item.id === opportunityId);
  if (!signal) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  let enrichmentOutcome = "completed";
  try {
    const result = await ensureContactEnrichment({
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
    const resultStatus = String(result?.result_json.status || "completed");
    if (["failed", "not_configured", "needs_domain", "needs_target"].includes(resultStatus)) {
      enrichmentOutcome = "unavailable";
    }
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

  const redirectUrl = new URL(`/opportunities/${opportunityId}`, request.url);
  redirectUrl.searchParams.set("scanId", scanId);
  redirectUrl.searchParams.set("enrichment", enrichmentOutcome);
  if (access) redirectUrl.searchParams.set("access", access);
  return NextResponse.redirect(redirectUrl, 303);
}
