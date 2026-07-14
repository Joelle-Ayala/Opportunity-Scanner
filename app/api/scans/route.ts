import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { executeScanPipeline } from "@/lib/scanPipeline";
import { claimScanRateLimit } from "@/lib/scanRateLimit";
import type { ScanRateLimitResult } from "@/lib/scanRateLimit";
import { createScan, updateScan } from "@/lib/storage";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { attachScanToCustomer, ensureCustomerAccount } from "@/lib/dashboard/repository";
import { enqueueScanNurture } from "@/lib/nurture";
import { CustomerType, ReportType, ScanInput } from "@/lib/types";
import { normalizeCompanyUrl } from "@/lib/url";

export const runtime = "nodejs";
export const maxDuration = 60;

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalStringArray(values: FormDataEntryValue[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function scanRejectedResponse(result: ScanRateLimitResult): Response {
  const limited = result.reason === "limited";
  const retryAfter = Math.max(1, result.retryAfterSeconds);
  const title = limited ? "You've reached the scan limit" : "Scanning is temporarily unavailable";
  const message = limited
    ? "Please wait before starting another scan. Your existing reports are still available."
    : "We couldn't safely start a new scan right now. Please try again in a minute.";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#f8fafc;color:#172033;font-family:Arial,sans-serif">
<main style="max-width:560px;margin:12vh auto;padding:32px">
<h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">${title}</h1>
<p style="font-size:17px;line-height:1.6;margin:0 0 24px">${message}</p>
<a href="/" style="color:#075985;font-weight:700">Return to Opportunity Scanner</a>
</main></body></html>`;

  return new Response(html, {
    status: limited ? 429 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": String(retryAfter)
    }
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const marketingConsent = formData.get("marketingConsent") === "on";
  const session = await resolveCustomerSession(getCustomerAuthConfig(request.url), cookies()).catch(() => null);
  let companyUrl: string;
  try {
    companyUrl = normalizeCompanyUrl(String(formData.get("companyUrl") ?? ""));
  } catch {
    redirect("/?error=invalid-url");
  }

  const input: ScanInput = {
    companyUrl,
    companyName: optionalString(formData.get("companyName")),
    headquartersState: optionalString(formData.get("headquartersState")),
    targetStates: optionalString(formData.get("targetStates")),
    industry: optionalString(formData.get("industry")),
    customerType: optionalString(formData.get("customerType")) as CustomerType | undefined,
    email: session?.user.email || optionalString(formData.get("email")),
    reportType: ((optionalString(formData.get("reportType")) as ReportType | undefined) ?? "quick"),
    opportunityFocus: optionalString(formData.get("opportunityFocus")),
    includeTerms: optionalString(formData.get("includeTerms")),
    excludeTerms: optionalString(formData.get("excludeTerms")),
    prioritySignals: optionalStringArray(formData.getAll("prioritySignals"))
  };

  const rateLimit = await claimScanRateLimit(request, input.email);
  if (!rateLimit.allowed) return scanRejectedResponse(rateLimit);

  const scan = await createScan(input);

  if (session?.user.email) {
    await ensureCustomerAccount(session.user.id, session.user.email);
    await attachScanToCustomer(session.user.id, scan.id);
  }

  try {
    await executeScanPipeline(scan.id, input);

    if (input.email && marketingConsent) {
      await enqueueScanNurture({
        scanId: scan.id,
        email: input.email,
        companyName: input.companyName,
        consentedAt: new Date().toISOString(),
        consentSource: "homepage_scan"
      }).catch((error) => {
        console.error("Unable to enroll completed scan in nurture sequence", {
          scanId: scan.id,
          error: error instanceof Error ? error.message : "Unknown nurture enrollment error"
        });
      });
    }
  } catch (error) {
    console.error("Scan pipeline failed", {
      scanId: scan.id,
      companyUrl: input.companyUrl,
      error: error instanceof Error ? error.message : "Unknown scan error"
    });
    await updateScan(scan.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown scan error"
    });
  }

  redirect(`/reports/${scan.id}`);
}
