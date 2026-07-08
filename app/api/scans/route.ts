import { redirect } from "next/navigation";
import {
  createScan,
  listProfileFeedbackForCompanyUrl,
  saveCompanyProfile,
  saveOpportunitySignals,
  updateScan
} from "@/lib/storage";
import { discoverExternalSignals } from "@/lib/connectors/discover";
import { generateCompanyProfile } from "@/lib/profile";
import { applyProfileFeedbackToProfile } from "@/lib/profileRefinement";
import { scrapeCompanyWebsite } from "@/lib/scraper";
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

export async function POST(request: Request) {
  const formData = await request.formData();
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
    email: optionalString(formData.get("email")),
    reportType: ((optionalString(formData.get("reportType")) as ReportType | undefined) ?? "quick"),
    opportunityFocus: optionalString(formData.get("opportunityFocus")),
    includeTerms: optionalString(formData.get("includeTerms")),
    excludeTerms: optionalString(formData.get("excludeTerms")),
    prioritySignals: optionalStringArray(formData.getAll("prioritySignals"))
  };

  const scan = await createScan(input);

  try {
    await updateScan(scan.id, { status: "scraping" });
    const scraped = await scrapeCompanyWebsite(companyUrl);

    await updateScan(scan.id, { status: "profiling" });
    const inferredProfile = await generateCompanyProfile(input, scraped.rawText);
    const priorFeedback = await listProfileFeedbackForCompanyUrl(companyUrl);
    const profile =
      priorFeedback.length > 0
        ? applyProfileFeedbackToProfile(inferredProfile, priorFeedback)
        : inferredProfile;
    await updateScan(scan.id, { selected_playbooks: profile.selected_playbooks });
    await saveCompanyProfile(scan.id, profile, scraped.rawText, scraped.pages);

    await updateScan(scan.id, { status: "discovering" });
    const signals = await discoverExternalSignals(profile);
    await saveOpportunitySignals(scan.id, signals, profile);

    await updateScan(scan.id, {
      status: "completed",
      completed_at: new Date().toISOString()
    });
  } catch (error) {
    await updateScan(scan.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown scan error"
    });
  }

  redirect(`/reports/${scan.id}`);
}
