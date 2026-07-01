import { NextResponse } from "next/server";
import { hideScanOpportunity, saveReportFeedback } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const opportunityId = String(form.get("opportunityId") || "");

  if (!scanId || !opportunityId) {
    return NextResponse.json({ error: "Invalid opportunity." }, { status: 400 });
  }

  await hideScanOpportunity({ scanId, opportunityId });
  await saveReportFeedback({
    scanId,
    opportunityId,
    feedbackKind: "less_like_this",
    reason: "Hidden from actionable table"
  });

  return NextResponse.redirect(new URL(`/reports/${scanId}?feedback=hidden`, request.url), 303);
}
