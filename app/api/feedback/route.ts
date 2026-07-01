import { NextResponse } from "next/server";
import { saveReportFeedback } from "@/lib/storage";
import { ReportFeedbackKind } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const opportunityId = String(form.get("opportunityId") || "") || null;
  const feedbackKind = String(form.get("feedbackKind") || "") as ReportFeedbackKind;
  const reason = String(form.get("reason") || "");

  if (!scanId || !["more_like_this", "less_like_this"].includes(feedbackKind)) {
    return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  }

  await saveReportFeedback({
    scanId,
    opportunityId,
    feedbackKind,
    reason
  });

  return NextResponse.redirect(new URL(`/reports/${scanId}?feedback=saved`, request.url), 303);
}
