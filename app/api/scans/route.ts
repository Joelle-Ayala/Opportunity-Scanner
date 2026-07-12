import { redirect } from "next/navigation";
import { executeScanPipeline } from "@/lib/scanPipeline";
import { createScan, updateScan } from "@/lib/storage";
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
    await executeScanPipeline(scan.id, input);
  } catch (error) {
    await updateScan(scan.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown scan error"
    });
  }

  redirect(`/reports/${scan.id}`);
}
