import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import {
  createMonitoredSearchFromScan,
  ensureCustomerAccount,
  MonitoringSetupError
} from "@/lib/dashboard/repository";

export const runtime = "nodejs";

function redirectTo(request: Request, pathname: string, parameters: Record<string, string> = {}) {
  const url = new URL(pathname, request.url);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function setupErrorRedirect(request: Request, scanId: string, error: MonitoringSetupError) {
  if (error.code === "AUTHENTICATION_REQUIRED") {
    return redirectTo(request, "/auth/sign-in", { next: "/dashboard/onboarding" });
  }
  if (error.code === "PLAN_REQUIRED") {
    return redirectTo(request, "/pricing", { source: "monitor_search", scanId });
  }
  return redirectTo(request, "/dashboard", {
    searchErrorCode: error.code,
    searchError: error.message,
    tab: "saved-searches"
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const session = await resolveCustomerSession(getCustomerAuthConfig(request.url), cookies()).catch(() => null);
  if (!session?.user.email) {
    return redirectTo(request, "/auth/sign-in", { next: `/reports/${scanId}` });
  }
  try {
    await ensureCustomerAccount(session.user.id, session.user.email);
    await createMonitoredSearchFromScan(session.user.id, scanId);
  } catch (error) {
    const setupError = error instanceof MonitoringSetupError
      ? error
      : new MonitoringSetupError("TEMPORARY_SETUP_FAILURE", error);
    if (setupError.code === "TEMPORARY_SETUP_FAILURE") console.error(setupError);
    return setupErrorRedirect(request, scanId, setupError);
  }
  return redirectTo(request, "/dashboard", { setup: "complete" });
}
