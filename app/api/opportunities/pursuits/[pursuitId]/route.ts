import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest } from "@/lib/customer-auth/redirect";
import { PursuitError, updateCustomerPursuit } from "@/lib/dashboard/pursuits";
import { isPursuitFitDecision, isPursuitStage, type PursuitEditableFields } from "@/lib/pursuit-contract";

export const runtime = "nodejs";

function text(form: FormData, name: string, maxLength: number): string {
  const value = String(form.get(name) || "").trim();
  if (value.length > maxLength) throw new Error(`${name} is too long.`);
  return value;
}

function redirectUrl(request: Request, scanId: string, opportunityId: string, kind: "pursuit" | "pursuitError", value: string) {
  const url = new URL(`/opportunities/${opportunityId}`, request.url);
  url.searchParams.set("scanId", scanId);
  url.searchParams.set(kind, value);
  return url;
}

function editableFields(form: FormData): PursuitEditableFields {
  const stage = String(form.get("stage") || "");
  if (!isPursuitStage(stage)) throw new Error("Choose a valid pursuit stage.");
  const fitDecision = String(form.get("fitDecision") || "");
  if (!isPursuitFitDecision(fitDecision)) throw new Error("Choose a valid fit decision.");
  const deadlineValue = text(form, "deadline", 10);
  if (deadlineValue && !/^\d{4}-\d{2}-\d{2}$/.test(deadlineValue)) {
    throw new Error("Enter a valid pursuit deadline.");
  }
  const deadline = deadlineValue || null;
  const requiredDocuments = text(form, "requiredDocuments", 6000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
  if (requiredDocuments.some((item) => item.length > 240)) {
    throw new Error("Keep each required document under 240 characters.");
  }
  return {
    stage,
    owner_name: text(form, "ownerName", 160),
    source_verified: form.get("sourceVerified") === "true",
    fit_decision: fitDecision,
    route_verified: form.get("routeVerified") === "true",
    deadline,
    next_step: text(form, "nextStep", 2000),
    eligibility_notes: text(form, "eligibilityNotes", 6000),
    registration_requirements: text(form, "registrationRequirements", 6000),
    required_documents: requiredDocuments,
    notes: text(form, "notes", 12000)
  };
}

export async function POST(request: Request, { params }: { params: { pursuitId: string } }): Promise<Response> {
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
  const scanId = String(form.get("scanId") || "").trim().slice(0, 64);
  const opportunityId = String(form.get("opportunityId") || "").trim().slice(0, 64);
  const session = await resolveCustomerSession(config, cookies()).catch(() => null);
  if (!session?.user.email) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", `/opportunities/${opportunityId}?scanId=${encodeURIComponent(scanId)}`);
    return NextResponse.redirect(signIn, 303);
  }

  try {
    await updateCustomerPursuit({
      authUserId: session.user.id,
      pursuitId: params.pursuitId,
      expectedVersion: Number(form.get("expectedVersion")),
      fields: editableFields(form)
    });
    console.info("product.pursuit_changed", { changeType: "saved" });
    return NextResponse.redirect(redirectUrl(request, scanId, opportunityId, "pursuit", "saved"), 303);
  } catch (error) {
    if (!(error instanceof PursuitError) && !(error instanceof Error && /valid|long/i.test(error.message))) {
      console.error("pursuit.update_failed", error);
    }
    const safeValidationMessage = error instanceof Error && /^(Add|Choose|Confirm|Enter|Keep)/.test(error.message)
      ? error.message
      : null;
    const message = error instanceof PursuitError
      ? error.message
      : safeValidationMessage || "The pursuit could not be saved. Please try again.";
    return NextResponse.redirect(redirectUrl(request, scanId, opportunityId, "pursuitError", message), 303);
  }
}
