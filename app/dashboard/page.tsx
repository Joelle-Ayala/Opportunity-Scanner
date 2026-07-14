import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerDashboard, type DashboardReportRow, type MonitoredSearchRow } from "@/components/dashboard";
import { BillingPortalButton } from "@/components/dashboard/billing-portal-button";
import { DashboardAnalytics } from "@/components/page-analytics";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import {
  ensureCustomerAccount,
  loadDashboardMonitoringRuns,
  loadDashboardReports,
  loadDashboardSavedSearches,
  loadDashboardSummary
} from "@/lib/dashboard/repository";
import { loadCustomerAlertPreferences } from "@/lib/deadlineAlerts/preferences";

export const dynamic = "force-dynamic";

function dateLabel(value?: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function reportStatus(status: string): DashboardReportRow["status"] {
  if (status === "completed") return "ready";
  if (status === "failed") return "failed";
  if (status === "queued") return "queued";
  return "scanning";
}

type DashboardSearchParams = {
  checkout?: string;
  searchNotice?: string;
  searchError?: string;
  alertNotice?: string;
  alertError?: string;
  tab?: string;
  setup?: string;
};

function configurationValue(configuration: Record<string, unknown> | undefined, key: string): string {
  const value = configuration?.[key];
  if (Array.isArray(value)) return value.map(String).join(", ");
  return typeof value === "string" ? value : "";
}

export default async function DashboardPage({ searchParams }: { searchParams?: DashboardSearchParams }) {
  let session;
  try {
    session = await resolveCustomerSession(getCustomerAuthConfig(), cookies());
  } catch {
    redirect("/auth/sign-in?next=%2Fdashboard");
  }
  if (!session?.user.email) redirect("/auth/sign-in?next=%2Fdashboard");

  await ensureCustomerAccount(session.user.id, session.user.email);
  const [summary, reports, searches, runs, alertPreferences] = await Promise.all([
    loadDashboardSummary(session.user.id),
    loadDashboardReports(session.user.id),
    loadDashboardSavedSearches(session.user.id),
    loadDashboardMonitoringRuns(session.user.id, { limit: 20 }),
    loadCustomerAlertPreferences(session.user.id)
  ]);
  const subscription = summary.billing.subscriptions.find((item) =>
    ["active", "trialing"].includes(item.status) && (item.product === "monitor" || item.product === "growth")
  );
  if (subscription && searches.length === 0) redirect("/dashboard/onboarding");

  const subscriptionPlan = subscription?.product === "growth" ? "growth" : subscription?.product === "monitor" ? "monitor" : "none";
  const subscriptionStatus = subscription?.status === "trialing" ? "trialing" : subscription ? "active" : "none";
  const planName = subscription?.product === "growth" ? "Growth" : subscription?.product === "monitor" ? "Monitor" : "Report access";
  const profileLimit = subscription?.product === "growth" ? 3 : subscription?.product === "monitor" ? 1 : 0;
  const monitoredScanIds = new Set([
    ...runs.map((run) => run.scanId),
    ...searches.flatMap((search) => search.monitoredProfile
      ? [search.monitoredProfile.sourceScanId, search.monitoredProfile.latestScanId].filter((id): id is string => Boolean(id))
      : [])
  ]);
  const reportRows: DashboardReportRow[] = reports.map((report) => ({
    id: report.scanId,
    companyName: report.companyName || new URL(report.companyUrl).hostname.replace(/^www\./, ""),
    companyUrl: report.companyUrl,
    createdLabel: dateLabel(report.completedAt || report.createdAt),
    status: reportStatus(report.status),
    reportType: report.hasActiveGrant || report.reportAccess === "paid" || (subscription && monitoredScanIds.has(report.scanId)) ? "Full report" : "Free report",
    href: `/reports/${report.scanId}`
  }));
  const searchRows: MonitoredSearchRow[] = searches.map((search) => ({
    id: search.id,
    name: search.name,
    querySummary: String(search.currentVersion?.configuration.opportunityFocus || search.currentVersion?.configuration.companyUrl || "Public-sector opportunity monitoring"),
    cadence: search.monitoredProfile?.cadence === "daily" ? "Daily" : "Weekly",
    status: search.status === "archived" ? "archived" : search.monitoredProfile?.status === "paused" || search.status === "paused" ? "paused" : search.monitoredProfile ? "active" : "attention",
    lastRunLabel: search.monitoredProfile?.lastRunAt ? `Last run ${dateLabel(search.monitoredProfile.lastRunAt)}` : undefined,
    nextRunLabel: search.monitoredProfile?.nextRunAt ? `Next run ${dateLabel(search.monitoredProfile.nextRunAt)}` : undefined,
    currentVersion: search.currentVersion?.version,
    criteria: {
      companyUrl: configurationValue(search.currentVersion?.configuration, "companyUrl"),
      industry: configurationValue(search.currentVersion?.configuration, "industry"),
      targetStates: configurationValue(search.currentVersion?.configuration, "targetStates"),
      customerType: configurationValue(search.currentVersion?.configuration, "customerType"),
      opportunityFocus: configurationValue(search.currentVersion?.configuration, "opportunityFocus"),
      includeTerms: configurationValue(search.currentVersion?.configuration, "includeTerms"),
      excludeTerms: configurationValue(search.currentVersion?.configuration, "excludeTerms")
    }
  }));
  const renewal = subscription?.currentPeriodEnd
    ? `${subscription.cancelAtPeriodEnd ? "Access ends" : "Renews"} ${dateLabel(subscription.currentPeriodEnd)}`
    : undefined;
  const sourceScanByProfile = new Map(
    searches.flatMap((search) => search.monitoredProfile
      ? [[search.monitoredProfile.id, search.monitoredProfile.sourceScanId] as const]
      : [])
  );
  const completedRunsByProfile = new Map<string, typeof runs>();
  for (const run of runs.filter((item) => item.status === "completed")) {
    const existing = completedRunsByProfile.get(run.monitoredProfileId) || [];
    existing.push(run);
    completedRunsByProfile.set(run.monitoredProfileId, existing);
  }
  const comparableScanIds = new Set<string>();
  for (const [profileId, profileRuns] of completedRunsByProfile) {
    profileRuns.forEach((run, index) => {
      const previousScanId = profileRuns[index + 1]?.scanId || sourceScanByProfile.get(profileId);
      if (previousScanId && previousScanId !== run.scanId) comparableScanIds.add(run.scanId);
    });
  }

  return (
    <main className="min-h-screen bg-field">
      <DashboardAnalytics
        subscriptionPlan={subscriptionPlan}
        hasActiveMonitoring={summary.activeMonitorCount > 0}
        onboardingCompleted={searchParams?.setup === "complete"}
      />
      {searchParams?.checkout === "success" ? <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-800">Your plan is active. Choose or create a report to begin monitoring.</div> : null}
      {searchParams?.searchNotice ? <div role="status" aria-live="polite" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-800">{searchParams.searchNotice}</div> : null}
      {searchParams?.searchError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-center text-sm font-semibold text-red-800">{searchParams.searchError}</div> : null}
      {searchParams?.alertNotice ? <div role="status" aria-live="polite" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-800">{searchParams.alertNotice}</div> : null}
      {searchParams?.alertError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-center text-sm font-semibold text-red-800">{searchParams.alertError}</div> : null}
      <CustomerDashboard
        title="Opportunity workspace"
        description="Reports, saved searches, monitoring changes, and billing in one place."
        initialTab={searchParams?.tab === "alerts" || searchParams?.alertNotice || searchParams?.alertError ? "alerts" : searchParams?.searchNotice || searchParams?.searchError ? "saved-searches" : "overview"}
        primaryAction={<a href="/dashboard/new" className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Run new report</a>}
        accountSlot={<form action="/api/auth/sign-out" method="post"><button className="text-sm font-semibold text-steel hover:text-accent">Sign out</button></form>}
        overview={{
          metrics: [
            { id: "reports", label: "Reports", value: summary.reportCount },
            { id: "searches", label: "Saved searches", value: summary.activeSavedSearchCount },
            { id: "monitors", label: "Active monitors", value: summary.activeMonitorCount, tone: "positive" },
            { id: "new", label: "New opportunities", value: summary.newOpportunityCount, tone: summary.newOpportunityCount ? "positive" : "default" }
          ],
          planName,
          planDescription: subscription ? "Ongoing opportunity monitoring" : "Buy reports individually or add monitoring.",
          renewalLabel: renewal,
          usage: [
            { id: "profiles", label: "Monitored profiles", used: summary.activeMonitorCount, limit: profileLimit },
            { id: "reports", label: "Reports", used: summary.reportCount, limit: null },
            ...(summary.enrichmentCredits.entitled
              ? [{
                  id: "enrichment-credits",
                  label: "Contact enrichment credits",
                  used: summary.enrichmentCredits.used,
                  remaining: summary.enrichmentCredits.remaining,
                  limit: summary.enrichmentCredits.limit
                }]
              : [{ id: "signals", label: "New opportunities", used: summary.newOpportunityCount, limit: null }])
          ],
          usageAction: <a href="/pricing" className="text-sm font-semibold text-accent">View plans</a>,
          recentReports: reportRows.slice(0, 5),
          monitoringChanges: runs.map((run) => ({ id: run.id, title: run.status === "failed" ? "Monitoring run needs attention" : `${run.newOpportunityCount} new opportunities found`, summary: run.errorMessage || "Your saved search was checked against the latest public records.", occurredLabel: dateLabel(run.completedAt || run.startedAt), kind: run.status === "failed" ? "system" as const : "new" as const, href: comparableScanIds.has(run.scanId) ? `/dashboard/compare/${run.scanId}` : `/reports/${run.scanId}` })),
          reportEmptyAction: <a href="/dashboard/new" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Run first report</a>
        }}
        reports={{ reports: reportRows, emptyAction: <a href="/dashboard/new" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Run first report</a>, renderMenu: (report) => <><a href={`/dashboard/new?from=${report.id}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">Update preview</a>{comparableScanIds.has(report.id) ? <a href={`/dashboard/compare/${report.id}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">Compare</a> : null}</> }}
        savedSearches={{ searches: searchRows, emptyAction: subscription ? <a href="/dashboard/onboarding" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Set up monitoring</a> : <a href="/pricing" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">View monitoring plans</a> }}
        alerts={{ preferences: alertPreferences, emailVerified: Boolean(session.user.email_confirmed_at) }}
        billing={{ planName, subscriptionStatus, planIntervalLabel: subscription?.billingInterval || undefined, renewalLabel: renewal, manageAction: subscription ? <BillingPortalButton /> : undefined, upgradeAction: <a href="/pricing" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">{subscription ? "Compare plans" : "View plans"}</a> }}
      />
    </main>
  );
}
