import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminMutation } from "@/lib/admin/access";
import { setSessionCookies } from "@/lib/customer-auth/cookies";
import { getScan, resolveQualityReviewScan } from "@/lib/storage";
import { deliverScanLifecycleEmailSafely } from "@/lib/transactionalEmail/scanLifecycle";

export const runtime = "nodejs";

const REVISION_REQUIRED_ERROR =
  "REVISION_REQUIRED_AFTER_HUMAN_REVIEW: Human review found that the held results did not meet the publication bar. This report was closed without publishing; create a new scan after correcting its search context.";

function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const form = await request.formData();
  const action = formString(form, "action");
  const access = formString(form, "access") || undefined;

  if (action !== "publish" && action !== "request_revision") {
    return NextResponse.json({ error: "Invalid quality-review resolution." }, { status: 400 });
  }

  const operator = await authorizeAdminMutation(request, access);
  if (!operator.authorized) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const scan = await getScan(params.id);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }
  if (scan.status !== "quality_review") {
    return NextResponse.json(
      { error: "Only scans held for quality review can be resolved." },
      { status: 409 }
    );
  }

  const completedAt = new Date().toISOString();
  const resolvedScan = await resolveQualityReviewScan(
    scan.id,
    action === "publish"
      ? {
          status: "completed",
          error_message: null,
          completed_at: completedAt
        }
      : {
          status: "failed",
          error_message: REVISION_REQUIRED_ERROR,
          completed_at: completedAt
        }
  );

  if (!resolvedScan) {
    return NextResponse.json(
      { error: "This scan is no longer held for quality review." },
      { status: 409 }
    );
  }

  await deliverScanLifecycleEmailSafely({
    scanId: resolvedScan.id,
    recipientEmail: resolvedScan.email,
    state: resolvedScan.status === "completed" ? "completed" : "failed"
  });

  const redirectUrl = new URL("/admin/reports", request.url);
  if (process.env.NODE_ENV !== "production" && access) {
    redirectUrl.searchParams.set("access", access);
  }
  redirectUrl.searchParams.set(
    "resolution",
    resolvedScan.status === "completed" ? "published" : "revision_requested"
  );
  const response = NextResponse.redirect(redirectUrl, 303);
  if (operator.refreshedTokens) setSessionCookies(response, operator.refreshedTokens);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
