import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest } from "@/lib/customer-auth/redirect";
import { startCustomerPursuit, PursuitError } from "@/lib/dashboard/pursuits";
import { getScan } from "@/lib/storage";
import { getCompletedReportReadiness } from "@/lib/reportReadiness";

export const runtime = "nodejs";

function opportunityUrl(request: Request, scanId: string, opportunityId: string, kind?: "pursuit" | "pursuitError", value?: string) {
  const url = new URL(`/opportunities/${opportunityId}`, request.url);
  url.searchParams.set("scanId", scanId);
  if (kind && value) url.searchParams.set(kind, value);
  return url;
}

export async function POST(request: Request): Promise<Response> {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch {
    return Response.json({ ok: false, error: "Pursuit workspace is unavailable." }, { status: 503 });
  }
  if (!isSameOriginRequest(request, config.appOrigin)) {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 403 });
  }

  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const opportunityId = String(form.get("opportunityId") || "");
  const nextPath = `/opportunities/${opportunityId}?scanId=${encodeURIComponent(scanId)}`;
  const session = await resolveCustomerSession(config, cookies()).catch(() => null);
  if (!session?.user.email) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", nextPath);
    return NextResponse.redirect(signIn, 303);
  }

  try {
    const scan = await getScan(scanId);
    if (!scan) throw new PursuitError("REPORT_ACCESS_REQUIRED");
    const readiness = await getCompletedReportReadiness(scan);
    const signal = readiness.ready
      ? readiness.signals.find((item) => item.id === opportunityId)
      : null;
    if (!readiness.ready || !signal) throw new PursuitError("REPORT_ACCESS_REQUIRED");

    await startCustomerPursuit({
      authUserId: session.user.id,
      email: session.user.email,
      scan,
      signal,
      profile: readiness.profile
    });
    console.info("product.pursuit_changed", { changeType: "started" });
    return NextResponse.redirect(opportunityUrl(request, scanId, opportunityId, "pursuit", "started"), 303);
  } catch (error) {
    if (!(error instanceof PursuitError)) console.error("pursuit.start_failed", error);
    const message = error instanceof PursuitError ? error.message : "The pursuit could not be started. Please try again.";
    return NextResponse.redirect(opportunityUrl(request, scanId, opportunityId, "pursuitError", message), 303);
  }
}
