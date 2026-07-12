import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { isSameOriginRequest } from "@/lib/customer-auth/redirect";
import { ensureCustomerAccount } from "@/lib/dashboard/repository";
import { updateCustomerAlertPreferences } from "@/lib/deadlineAlerts/preferences";

export const runtime = "nodejs";

function redirectToDashboard(request: Request, kind: "alertNotice" | "alertError", message: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("tab", "alerts");
  url.searchParams.set(kind, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request): Promise<Response> {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch {
    return redirectToDashboard(request, "alertError", "Alert preferences are temporarily unavailable.");
  }
  if (!isSameOriginRequest(request, config.appOrigin)) {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 403 });
  }

  const session = await resolveCustomerSession(config, cookies()).catch(() => null);
  if (!session?.user.email) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", "/dashboard?tab=alerts");
    return NextResponse.redirect(signIn, 303);
  }

  try {
    const form = await request.formData();
    await ensureCustomerAccount(session.user.id, session.user.email);
    await updateCustomerAlertPreferences(session.user.id, {
      emailEnabled: form.get("emailEnabled") === "true",
      newOpportunityEmailEnabled: form.get("newOpportunityEmailEnabled") === "true",
      deadlineEmailEnabled: form.get("deadlineEmailEnabled") === "true",
      deadlineReminderDays: form.getAll("deadlineReminderDays").map(Number)
    });
    return redirectToDashboard(request, "alertNotice", "Alert preferences saved.");
  } catch {
    return redirectToDashboard(request, "alertError", "Alert preferences could not be saved.");
  }
}

