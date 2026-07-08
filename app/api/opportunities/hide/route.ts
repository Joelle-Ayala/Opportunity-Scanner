import { NextResponse } from "next/server";
import { getScan, hideScanOpportunity, saveReportFeedback } from "@/lib/storage";
import { hasAdminAccess } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const opportunityId = String(form.get("opportunityId") || "");

  if (!scanId || !opportunityId) {
    return NextResponse.json({ error: "Invalid opportunity." }, { status: 400 });
  }

  const scan = await getScan(scanId);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const access = String(form.get("access") || "") || undefined;
  if (!hasAdminAccess(access, scan)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await hideScanOpportunity({ scanId, opportunityId });
  await saveReportFeedback({
    scanId,
    opportunityId,
    feedbackKind: "less_like_this",
    reason: "Hidden from actionable table"
  });

  const accessParam = access ? `&access=${encodeURIComponent(access)}` : "";
  return NextResponse.redirect(new URL(`/reports/${scanId}?feedback=hidden${accessParam}`, request.url), 303);
}
