import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerDashboard, DashboardActionLink, type DashboardReportRow, type MonitoredSearchRow } from "@/components/dashboard";
import { BillingPortalButton } from "@/components/dashboard/billing-portal-button";
import type { BillingSummaryProps } from "@/components/dashboard/billing-summary";
import { DashboardAnalytics } from "@/components/page-analytics";
import { getCustomerAuthConfig, resolveCustomerPageSession } from "@/lib/customer-auth";
import {
  ensureCustomerAccount,
  loadDashboardMonitoringRuns,
  loadDashboardReports,
  loadDashboardSavedSearches,
  loadDashboardSummary
} from "@/lib/dashboard/repository";
import { workspaceCompanyFor } from "@/lib/dashboard/workspace-identity";
import { loadCustomerAlertPreferences } from "@/lib/deadlineAlerts/preferences";

export const dynamic = "force-dynamic";

function dateLabel(value?: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function reportStatus(status: string): DashboardReportRow["status"] {
  if (status === "completed") return "ready";
  if (status === "quality_review") return "review";
  if (status === "failed") return "failed";
  if (status === "queued") return "queued";
  return "scanning";
}

function reportCompanyName(companyName: string | null, companyUrl: string): string {
  if (companyName) return companyName;
  try {
    return new URL(companyUrl).hostname.replace(/^www\./, "");
  } catch {
    return companyUrl.replace(/^https?:\/\//, "").split("/")[0] || "Company";
  }
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

type BillingSubscription = {
  product: "monitor" | "growth" | null;
  status: string;
  cancelAtPeriodEnd: boolean;
};

function billingStatusFor(subscription?: BillingSubscription): BillingSummaryProps["subscriptionStatus"] {
  if (!subscription) return "none";
  if (["active", "trialing"].includes(subscription.status) && subscription.cancelAtPeriodEnd) return "canceling";
  if (subscription.status === "active" || subscription.status === "trialing") return subscription.status;
  if (subscription.status === "past_due" || subscription.status === "unpaid") return "past_due";
  if (subscription.status === "incomplete" || subscription.status === "paused") return "incomplete";
  return "canceled";
}

function planDescriptionFor(status: BillingSummaryProps["subscriptionStatus"]): string {
  if (status === "active") return "Ongoing opportunity monitoring";
  if (status === "trialing") return "Opportunity monitoring is active during your trial.";
  if (status === "canceling") return "Monitoring remains available until the current billing period ends.";
  if (status === "past_due") return "Monitoring is paused until the payment issue is resolved.";
  if (status === "incomplete") return "Complete billing setup before monitoring can begin.";
  if (status === "canceled") return "This monitoring subscription is canceled.";
  return "Full access to your purchased reports.";
}

export default async function DashboardPage({ searchParams }: { searchParams?: DashboardSearchParams }) {
  let resolution;
  try {
    resolution = await resolveCustomerPageSession(getCustomerAuthConfig(), cookies());
  } catch {
    redirect("/auth/sign-in?next=%2Fdashboard");
  }
  if (resolution.refreshRequired) redirect("/api/auth/session?next=%2Fdashboard");
  const session = resolution.session;
  if (!session?.user.email) redirect("/auth/sign-in?next=%2Fdashboard");

  await ensureCustomerAccount(session.user.id, session.user.email);
  const [summary, reports, searches, runs, alertPreferences] = await Promise.all([
    loadDashboardSummary(session.user.id),
    loadDashboardReports(session.user.id),
    loadDashboardSavedSearches(session.user.id),
    loadDashboardMonitoringRuns(session.user.id, { limit: 20 }),
    loadCustomerAlertPreferences(session.user.id)
  ]);
  const monitoringSubscriptions = summary.billing.subscriptions.filter(
    (item) => item.product === "monitor" || item.product === "growth"
  );
  const subscription = monitoringSubscriptions.find((item) => ["active", "trialing"].includes(item.status));
  const billingSubscription = subscription || monitoringSubscriptions[0];
  const subscriptionStatus = billingStatusFor(billingSubscription);
  const activeMonitorCount = subscription ? summary.activeMonitorCount : 0;

  const subscriptionPlan = subscription?.product === "growth" ? "growth" : subscription?.product === "monitor" ? "monitor" : "none";
  const planName = billingSubscription?.product === "growth" ? "Growth" : billingSubscription?.product === "monitor" ? "Monitor" : "Report access";
  const profileLimit = subscription?.product === "growth" ? 3 : subscription?.product === "monitor" ? 1 : 0;
  const capacityUsedCount = subscription
    ? searches.filter((search) => search.monitoredProfile && search.monitoredProfile.status !== "canceled").length
    : 0;
  const hasMonitoringCapacity = Boolean(subscription && capacityUsedCount < profileLimit);
  const needsMonitoringSetup = Boolean(subscription && capacityUsedCount === 0);
  const monitoredSourceScanIds = new Set(
    searches.flatMap((search) => search.monitoredProfile ? [search.monitoredProfile.sourceScanId] : [])
  );
  const eligibleMonitoringReportIds = new Set(
    reports
      .filter((report) => report.status === "completed" && !monitoredSourceScanIds.has(report.scanId))
      .map((report) => report.scanId)
  );
  const monitoredScanIds = new Set([
    ...runs.map((run) => run.scanId),
    ...searches.flatMap((search) => search.monitoredProfile
      ? [search.monitoredProfile.sourceScanId, search.monitoredProfile.latestScanId].filter((id): id is string => Boolean(id))
      : [])
  ]);
  const reportRows: DashboardReportRow[] = reports.map((report) => ({
    id: report.scanId,
    companyName: reportCompanyName(report.companyName, report.companyUrl),
    companyUrl: report.companyUrl,
    createdLabel: dateLabel(report.completedAt || report.createdAt),
    status: reportStatus(report.status),
    reportType: report.hasFullAccountAccess || report.hasActiveGrant || report.reportAccess === "paid" || (subscription && monitoredScanIds.has(report.scanId)) ? "Full report" : "Free report",
    signalCount: report.signalCount,
    href: `/reports/${report.scanId}`
  }));
  const latestReadyReport = reportRows.find((report) => report.status === "ready" && report.href);
  const fullReportCount = reportRows.filter((report) => report.reportType === "Full report").length;
  const workspaceCompany = workspaceCompanyFor(session.user.email, reportRows);
  const searchRows: MonitoredSearchRow[] = searches.map((search) => ({
    id: search.id,
    name: search.name,
    querySummary: String(search.currentVersion?.configuration.opportunityFocus || search.currentVersion?.configuration.companyUrl || "Public-sector opportunity monitoring"),
    cadence: search.monitoredProfile?.cadence === "daily" ? "Daily" : "Weekly",
    status: search.status === "archived"
      ? "archived"
      : search.monitoredProfile?.status === "paused" || search.status === "paused"
        ? "paused"
        : search.monitoredProfile?.status === "active" && subscription
          ? "active"
          : "attention",
    lastRunLabel: search.monitoredProfile?.lastRunAt ? `Last run ${dateLabel(search.monitoredProfile.lastRunAt)}` : undefined,
    nextRunLabel: subscription && search.monitoredProfile?.status === "active" && search.monitoredProfile.nextRunAt
      ? `Next run ${dateLabel(search.monitoredProfile.nextRunAt)}`
      : undefined,
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
  const renewal = billingSubscription?.currentPeriodEnd && ["active", "trialing", "canceling"].includes(subscriptionStatus)
    ? `${subscriptionStatus === "canceling" ? "Access ends" : "Renews"} ${dateLabel(billingSubscription.currentPeriodEnd)}`
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
        hasActiveMonitoring={activeMonitorCount > 0}
        onboardingCompleted={searchParams?.setup === "complete"}
      />
      {searchParams?.checkout === "success" ? <div className="border-b border-cyan-200 bg-cyan-50 px-5 py-3 text-center text-sm font-semibold text-cyan-900">{subscription ? "Your plan is active. Choose or create a report to begin monitoring." : "Billing setup was received. Review the status below before starting monitoring."}</div> : null}
      {searchParams?.searchNotice ? <div role="status" aria-live="polite" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-800">{searchParams.searchNotice}</div> : null}
      {searchParams?.searchError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-center text-sm font-semibold text-red-800">{searchParams.searchError}</div> : null}
      {searchParams?.alertNotice ? <div role="status" aria-live="polite" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-semibold text-emerald-800">{searchParams.alertNotice}</div> : null}
      {searchParams?.alertError ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-center text-sm font-semibold text-red-800">{searchParams.alertError}</div> : null}
      {needsMonitoringSetup ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-amber-950">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="text-sm font-semibold">Your plan is active, but monitoring setup is not complete yet.</p>
            <a href="/dashboard/onboarding" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-accent">Continue setup</a>
          </div>
        </div>
      ) : null}
      <CustomerDashboard
        title={workspaceCompany ? `${workspaceCompany} workspace` : "Opportunity workspace"}
        description="Continue recent reports, run fresh searches, and manage monitoring."
        initialTab={subscription && (searchParams?.tab === "alerts" || searchParams?.alertNotice || searchParams?.alertError) ? "alerts" : searchParams?.searchNotice || searchParams?.searchError ? "saved-searches" : searchParams?.tab === "billing" ? "billing" : "overview"}
        showAlerts={Boolean(subscription)}
        primaryAction={needsMonitoringSetup
          ? <a href="/dashboard/onboarding" className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Continue setup</a>
          : hasMonitoringCapacity
            ? <a href="/dashboard/onboarding" className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Add monitored search</a>
          : <DashboardActionLink action="new_report" href="/dashboard/new" className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Run new report</DashboardActionLink>}
        accountSlot={<form action="/api/auth/sign-out" method="post"><button className="text-sm font-semibold text-steel hover:text-accent">Sign out</button></form>}
        overview={{
          focus: latestReadyReport ? {
            eyebrow: "Pick up where you left off",
            title: `${latestReadyReport.companyName} opportunity report`,
            detail: `${latestReadyReport.reportType || "Opportunity report"} / Updated ${latestReadyReport.createdLabel}`,
            primaryAction: <DashboardActionLink action="open_report" href={latestReadyReport.href || "/dashboard"} className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Open report</DashboardActionLink>,
            secondaryAction: <DashboardActionLink action="refresh_report" href={`/dashboard/new?from=${encodeURIComponent(latestReadyReport.id)}`} className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent">Refresh report</DashboardActionLink>
          } : undefined,
          metrics: [
            { id: "reports", label: "Reports", value: summary.reportCount },
            { id: "searches", label: "Saved searches", value: summary.activeSavedSearchCount },
            { id: "monitors", label: "Active monitors", value: activeMonitorCount, tone: activeMonitorCount ? "positive" : "default" },
            { id: "new", label: "New opportunities", value: summary.newOpportunityCount, tone: summary.newOpportunityCount ? "positive" : "default" }
          ],
          planName,
          planDescription: planDescriptionFor(subscriptionStatus),
          renewalLabel: renewal,
          usage: subscription ? [
            { id: "profiles", label: "Monitored profiles", used: capacityUsedCount, limit: profileLimit },
            { id: "reports", label: "Reports", used: summary.reportCount, limit: null, unlimitedLabel: "No monthly limit" },
            ...(summary.enrichmentCredits.entitled
              ? [{
                  id: "enrichment-credits",
                  label: "Contact enrichment credits",
                  used: summary.enrichmentCredits.used,
                  remaining: summary.enrichmentCredits.remaining,
                  limit: summary.enrichmentCredits.limit
                }]
              : [{ id: "signals", label: "New opportunities", used: summary.newOpportunityCount, limit: null }])
          ] : [
            { id: "full-reports", label: "Full reports", used: fullReportCount, limit: null },
            { id: "reports", label: "Reports in workspace", used: summary.reportCount, limit: null },
            { id: "searches", label: "Saved searches", used: summary.activeSavedSearchCount, limit: null }
          ],
          usageAction: <DashboardActionLink action="view_plans" href="/pricing" className="text-sm font-semibold text-accent">View plans</DashboardActionLink>,
          recentReports: reportRows.slice(0, 5),
          monitoringChanges: runs.map((run) => ({ id: run.id, title: run.status === "failed" ? "Monitoring run needs attention" : `${run.newOpportunityCount} new opportunities found`, summary: run.errorMessage || "Your saved search was checked against the latest public records.", occurredLabel: dateLabel(run.completedAt || run.startedAt), kind: run.status === "failed" ? "system" as const : "new" as const, href: comparableScanIds.has(run.scanId) ? `/dashboard/compare/${run.scanId}` : `/reports/${run.scanId}` })),
          monitoringDescription: subscription
            ? "Recent changes across your active saved searches."
            : "Recurring checks and deadline alerts.",
          monitoringEmptyMessage: !subscription && latestReadyReport
            ? `${latestReadyReport.companyName} is not monitored yet.`
            : undefined,
          monitoringEmptyAction: !subscription && latestReadyReport
            ? <DashboardActionLink action="view_plans" href="/pricing" className="rounded-md border border-accent bg-white px-3 py-2 text-sm font-semibold text-accent hover:bg-mist">Keep {latestReadyReport.companyName} current</DashboardActionLink>
            : undefined,
          reportEmptyAction: <a href="/dashboard/new" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Run first report</a>
        }}
        reports={{ reports: reportRows, emptyAction: <a href="/dashboard/new" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Run first report</a>, renderMenu: (report) => <><a href={`/dashboard/new?from=${report.id}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">Update preview</a>{hasMonitoringCapacity && eligibleMonitoringReportIds.has(report.id) ? <a href={`/dashboard/onboarding?source_scan_id=${encodeURIComponent(report.id)}`} className="rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-mist">Monitor</a> : null}{comparableScanIds.has(report.id) ? <a href={`/dashboard/compare/${report.id}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">Compare</a> : null}</> }}
        savedSearches={{
          searches: searchRows,
          emptyAction: subscription
            ? hasMonitoringCapacity
              ? <a href="/dashboard/onboarding" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Set up monitoring</a>
              : <span className="text-sm font-semibold text-amber-900">Plan limit reached</span>
            : <a href="/pricing" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">View monitoring plans</a>,
          addMonitoringAction: hasMonitoringCapacity
            ? <a href="/dashboard/onboarding" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-[#0A6871]">Add monitored search</a>
            : undefined,
          monitoringCapacity: subscription ? { used: capacityUsedCount, limit: profileLimit } : undefined
        }}
        alerts={{ preferences: alertPreferences, emailVerified: Boolean(session.user.email_confirmed_at) }}
        billing={{ planName, subscriptionStatus, planIntervalLabel: billingSubscription?.billingInterval || undefined, renewalLabel: renewal, manageAction: summary.billing.stripeCustomerId ? <BillingPortalButton /> : undefined, upgradeAction: <a href="/pricing" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">{billingSubscription ? "Compare plans" : "View plans"}</a> }}
      />
    </main>
  );
}
