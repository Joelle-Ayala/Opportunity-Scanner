import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import {
  ensureCustomerAccount,
  loadDashboardBillingState,
  loadDashboardSavedSearches,
  requestSavedSearchRunNow,
  setSavedSearchStatus,
  updateSavedSearch
} from "@/lib/dashboard/repository";
import type { SavedSearchConfiguration } from "@/lib/dashboard/types";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dashboardRedirect(request: Request, kind: "searchNotice" | "searchError", message: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set(kind, message);
  return NextResponse.redirect(url, 303);
}

function textField(form: FormData, name: string, maxLength: number): string {
  const value = String(form.get(name) || "").trim();
  if (value.length > maxLength) throw new Error(`${name} is too long.`);
  return value;
}

function editableConfiguration(form: FormData, current: SavedSearchConfiguration): SavedSearchConfiguration {
  return {
    ...current,
    companyUrl: textField(form, "companyUrl", 2048),
    industry: textField(form, "industry", 160),
    targetStates: textField(form, "targetStates", 500),
    customerType: textField(form, "customerType", 120),
    opportunityFocus: textField(form, "opportunityFocus", 2000),
    includeTerms: textField(form, "includeTerms", 1000),
    excludeTerms: textField(form, "excludeTerms", 1000)
  };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "The saved search could not be updated.";
  if (/limit|plan|subscription/i.test(message)) return message;
  if (/not found|owned|access|authenticated/i.test(message)) return "That saved search is not available to this account.";
  return message.length <= 180 ? message : "The saved search could not be updated.";
}

export async function POST(request: Request, { params }: { params: { searchId: string } }) {
  const session = await resolveCustomerSession(getCustomerAuthConfig(request.url), cookies()).catch(() => null);
  if (!session?.user.email) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", "/dashboard");
    return NextResponse.redirect(signIn, 303);
  }
  if (!UUID_PATTERN.test(params.searchId)) return dashboardRedirect(request, "searchError", "That saved search is not valid.");

  const form = await request.formData();
  const action = String(form.get("action") || "");

  try {
    await ensureCustomerAccount(session.user.id, session.user.email);

    if (action === "edit") {
      const name = textField(form, "name", 120);
      const companyUrl = textField(form, "companyUrl", 2048);
      if (!name) throw new Error("Search name is required.");
      try {
        const url = new URL(companyUrl);
        if (!/^https?:$/.test(url.protocol)) throw new Error();
      } catch {
        throw new Error("Enter a valid company website URL.");
      }
      const searches = await loadDashboardSavedSearches(session.user.id);
      const search = searches.find((item) => item.id === params.searchId && item.status !== "archived");
      if (!search?.currentVersion) throw new Error("That saved search is not available to this account.");
      await updateSavedSearch(session.user.id, params.searchId, {
        name,
        configuration: editableConfiguration(form, search.currentVersion.configuration)
      });
      return dashboardRedirect(request, "searchNotice", `Saved ${name} as a new search version.`);
    }

    if (action === "pause" || action === "resume") {
      if (action === "resume") {
        const [searches, billing] = await Promise.all([
          loadDashboardSavedSearches(session.user.id),
          loadDashboardBillingState(session.user.id)
        ]);
        const search = searches.find((item) => item.id === params.searchId && item.status !== "archived");
        if (!search) throw new Error("That saved search is not available to this account.");
        const subscription = billing.subscriptions.find((item) => ["active", "trialing"].includes(item.status));
        const limit = subscription?.product === "growth" ? 3 : subscription?.product === "monitor" ? 1 : 0;
        const activeCount = searches.filter((item) => item.id !== params.searchId && item.monitoredProfile?.status === "active").length;
        if (!search.monitoredProfile || activeCount >= limit) throw new Error("Your monitored profile plan limit has been reached.");
      }
      await setSavedSearchStatus(session.user.id, params.searchId, action === "resume" ? "active" : "paused");
      return dashboardRedirect(request, "searchNotice", action === "resume" ? "Monitoring resumed." : "Monitoring paused.");
    }

    if (action === "archive") {
      await setSavedSearchStatus(session.user.id, params.searchId, "archived");
      return dashboardRedirect(request, "searchNotice", "Saved search archived.");
    }

    if (action === "run") {
      const result = await requestSavedSearchRunNow(session.user.id, params.searchId);
      return dashboardRedirect(
        request,
        "searchNotice",
        result.enqueued
          ? "Monitoring run queued for the next scheduled check."
          : "A monitoring run is already queued or this profile is in its cooldown window."
      );
    }

    return dashboardRedirect(request, "searchError", "Choose a valid saved-search action.");
  } catch (error) {
    return dashboardRedirect(request, "searchError", errorMessage(error));
  }
}
