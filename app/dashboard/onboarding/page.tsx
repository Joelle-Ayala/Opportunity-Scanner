import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/brand";
import { BillingPortalButton } from "@/components/dashboard/billing-portal-button";
import { MonitoringOnboardingAnalytics, PurchaseCompletedAnalytics } from "@/components/page-analytics";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import {
  ensureCustomerAccount,
  loadDashboardReports,
  loadDashboardSavedSearches,
  loadDashboardSummary
} from "@/lib/dashboard/repository";
import { verifySubscriptionCheckoutHandoff } from "@/lib/payments/subscriptionHandoff";

export const dynamic = "force-dynamic";

function companyName(report: { companyName: string | null; companyUrl: string }): string {
  if (report.companyName) return report.companyName;
  try { return new URL(report.companyUrl).hostname.replace(/^www\./, ""); } catch { return report.companyUrl; }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MonitoringOnboardingPage({
  searchParams
}: {
  searchParams?: { checkout?: string; session_id?: string; source_scan_id?: string };
}) {
  const checkoutSessionId = searchParams?.session_id;
  const validCheckoutReturn =
    searchParams?.checkout === "success" &&
    Boolean(checkoutSessionId && /^cs_(test_|live_)?[A-Za-z0-9]+$/.test(checkoutSessionId));
  const next = validCheckoutReturn
    ? `/dashboard/onboarding?checkout=success&session_id=${encodeURIComponent(checkoutSessionId!)}`
    : "/dashboard/onboarding";
  const session = await resolveCustomerSession(getCustomerAuthConfig(), cookies()).catch(() => null);
  if (!session?.user.email) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  const account = await ensureCustomerAccount(session.user.id, session.user.email);
  const handoff = validCheckoutReturn
    ? await verifySubscriptionCheckoutHandoff({
        authUserId: session.user.id,
        customerAccountId: account.id,
        verifiedEmail: session.user.email,
        sessionId: checkoutSessionId
      })
    : null;
  if (handoff?.status === "fulfilled") {
    const params = new URLSearchParams({ checkout: "success" });
    if (handoff.sourceScanId) params.set("source_scan_id", handoff.sourceScanId);
    redirect(`/dashboard/onboarding?${params.toString()}`);
  }
  const [summary, reports, searches] = await Promise.all([
    loadDashboardSummary(session.user.id),
    loadDashboardReports(session.user.id),
    loadDashboardSavedSearches(session.user.id)
  ]);
  const subscription = summary.billing.subscriptions.find((item) => ["active", "trialing"].includes(item.status));
  if (!subscription?.product && handoff?.status !== "unavailable") redirect("/pricing?source=onboarding");
  if (!subscription?.product) {
    return (
      <main className="min-h-screen bg-field">
        <SiteHeader rightSlot={<a href="/dashboard" className="text-sm font-semibold text-steel hover:text-accent">Dashboard</a>} />
        <section className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase text-accent">Plan activation</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Your payment is complete. We are activating monitoring.</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted">
            Stripe confirmation is taking a little longer than usual. Your purchase is not lost; refresh this page in a moment to continue setup.
          </p>
          <a href={next} className="mt-7 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white">Check activation</a>
        </section>
      </main>
    );
  }
  const limit = subscription.product === "growth" ? 3 : 1;
  const capacityUsedCount = searches.filter(
    (search) => search.monitoredProfile && search.monitoredProfile.status !== "canceled"
  ).length;
  const monitoredScanIds = new Set(searches.flatMap((search) => search.monitoredProfile ? [search.monitoredProfile.sourceScanId] : []));
  const eligibleReports = reports.filter((report) => report.status === "completed" && !monitoredScanIds.has(report.scanId));
  const requestedSourceScanId = UUID_PATTERN.test(searchParams?.source_scan_id ?? "")
    ? searchParams!.source_scan_id!.toLowerCase()
    : null;
  const selectedReport = requestedSourceScanId && capacityUsedCount < limit
    ? eligibleReports.find((report) => report.scanId === requestedSourceScanId) ?? null
    : null;
  const otherEligibleReports = selectedReport
    ? eligibleReports.filter((report) => report.scanId !== selectedReport.scanId)
    : eligibleReports;
  const onboardingState = capacityUsedCount >= limit
    ? "limit_reached"
    : eligibleReports.length > 0
      ? "eligible_report"
      : "report_required";

  return (
    <main className="min-h-screen bg-field">
      <MonitoringOnboardingAnalytics subscriptionPlan={subscription.product} state={onboardingState} />
      {searchParams?.checkout === "success" ? (
        <PurchaseCompletedAnalytics
          plan="subscription"
          billingPeriod={subscription.billingInterval === "annual" ? "annual" : "monthly"}
          eventKey={`subscription:${subscription.id}`}
        />
      ) : null}
      <SiteHeader rightSlot={<a href="/dashboard" className="text-sm font-semibold text-steel hover:text-accent">Dashboard</a>} />
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase text-accent">Monitoring setup</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          {selectedReport ? "Your report is ready for monitoring setup." : "Choose what Opportunity Scanner should keep watching."}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Your {subscription.product === "growth" ? "Growth" : "Monitor"} plan includes {limit} monitored {limit === 1 ? "company profile" : "company profiles"}. You are using {capacityUsedCount}.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="/dashboard?tab=billing" className="text-sm font-semibold text-accent hover:text-ink">View account status</a>
          {summary.billing.stripeCustomerId ? <BillingPortalButton /> : null}
        </div>

        {capacityUsedCount >= limit ? (
          <div className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Your plan limit is currently full. Archive a saved search before adding another.
            <a href="/dashboard" className="ml-2 font-semibold underline">Manage saved searches</a>
          </div>
        ) : selectedReport ? (
          <div className="mt-7 grid gap-5">
            <div className="overflow-hidden rounded-lg border border-accent bg-white shadow-sm">
              <div className="border-b border-cyan-100 bg-mist px-5 py-4">
                <p className="text-xs font-semibold uppercase text-accent">Selected from checkout</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Continue with this report</h2>
                <p className="mt-1 text-sm text-muted">Review the company below, then create its first saved monitoring search.</p>
              </div>
              <form action="/api/dashboard/searches" method="post" className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
                <input type="hidden" name="scanId" value={selectedReport.scanId} />
                <input type="hidden" name="next" value="/dashboard?setup=complete" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-ink">{companyName(selectedReport)}</p>
                  <p className="mt-1 break-all text-xs text-muted">{selectedReport.companyUrl}</p>
                </div>
                <button className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Start monitoring this report</button>
              </form>
            </div>

            {otherEligibleReports.length > 0 ? (
              <details className="overflow-hidden rounded-lg border border-line bg-white">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink hover:text-accent">
                  Choose a different owned report
                </summary>
                <div className="divide-y divide-line border-t border-line">
                  {otherEligibleReports.map((report) => (
                    <form key={report.scanId} action="/api/dashboard/searches" method="post" className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                      <input type="hidden" name="scanId" value={report.scanId} />
                      <input type="hidden" name="next" value="/dashboard?setup=complete" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-ink">{companyName(report)}</p>
                        <p className="mt-1 break-all text-xs text-muted">{report.companyUrl}</p>
                      </div>
                      <button className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent">Use this report</button>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : eligibleReports.length > 0 ? (
          <div className="mt-7 overflow-hidden rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">Start from an existing report</h2>
              <p className="mt-1 text-sm text-muted">Its company, geography, focus, and search terms become your first saved-search version.</p>
            </div>
            <div className="divide-y divide-line">
              {eligibleReports.map((report) => (
                <form key={report.scanId} action="/api/dashboard/searches" method="post" className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <input type="hidden" name="scanId" value={report.scanId} />
                  <input type="hidden" name="next" value="/dashboard?setup=complete" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-ink">{companyName(report)}</p>
                    <p className="mt-1 break-all text-xs text-muted">{report.companyUrl}</p>
                  </div>
                  <button className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Monitor this search</button>
                </form>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-7 rounded-lg border border-line bg-white p-6">
            <h2 className="text-lg font-semibold text-ink">Create the first report to monitor</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Run a report with the company, geography, and opportunity focus you want the plan to track.</p>
            <a href="/dashboard/new" className="mt-5 inline-flex rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white">Run a report</a>
          </div>
        )}
      </section>
    </main>
  );
}
