import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/brand";
import {
  ReportComparisonView,
  type ReportComparisonOpportunity,
  type ReportComparisonStatus
} from "@/components/comparison";
import { getCustomerAuthConfig, resolveCustomerPageSession } from "@/lib/customer-auth";
import {
  ensureCustomerAccount,
  loadOwnedMonitoringComparisonPair
} from "@/lib/dashboard/repository";
import { compareStoredOpportunitySignals } from "@/lib/monitoring/comparison";
import { getScan, listScanOpportunitySignals } from "@/lib/storage";

export const dynamic = "force-dynamic";

function dateLabel(value?: string | null): string {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function DashboardComparisonPage({ params }: { params: { scanId: string } }) {
  const next = `/dashboard/compare/${params.scanId}`;
  const resolution = await resolveCustomerPageSession(getCustomerAuthConfig(), cookies())
    .catch(() => ({ session: null, refreshRequired: false }));
  if (resolution.refreshRequired) redirect(`/api/auth/session?next=${encodeURIComponent(next)}`);
  const session = resolution.session;
  if (!session?.user.email) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  await ensureCustomerAccount(session.user.id, session.user.email);
  const pair = await loadOwnedMonitoringComparisonPair(session.user.id, params.scanId);
  if (!pair) notFound();

  const [currentScan, previousScan, currentSignals, previousSignals] = await Promise.all([
    getScan(pair.currentScanId),
    getScan(pair.previousScanId),
    listScanOpportunitySignals(pair.currentScanId),
    listScanOpportunitySignals(pair.previousScanId)
  ]);
  if (!currentScan || !previousScan) notFound();
  const comparison = compareStoredOpportunitySignals(
    previousSignals,
    currentSignals,
    currentScan.completed_at || currentScan.created_at
  );
  const opportunities: ReportComparisonOpportunity[] = [
    ...comparison.current.map((entry) => ({
      id: `${entry.status}-${entry.key}`,
      title: entry.signal.opportunity_title,
      agency: entry.signal.agency_or_funder || "Agency or funder not stated",
      deadline: entry.signal.deadline,
      source: entry.signal.source_name,
      sourceHref: entry.signal.source_url,
      opportunityHref: `/opportunities/${entry.signal.id}?scanId=${pair.currentScanId}`,
      status: entry.status as ReportComparisonStatus,
      changes: entry.changes.map((change) => ({ field: change.label, before: change.before, after: change.after }))
    })),
    ...comparison.previous.map((entry) => ({
      id: `${entry.status}-${entry.key}`,
      title: entry.signal.opportunity_title,
      agency: entry.signal.agency_or_funder || "Agency or funder not stated",
      deadline: entry.signal.deadline,
      source: entry.signal.source_name,
      sourceHref: entry.signal.source_url,
      opportunityHref: `/opportunities/${entry.signal.id}?scanId=${pair.previousScanId}`,
      status: entry.status as ReportComparisonStatus,
      changes: []
    }))
  ];
  const filterOrder: ReportComparisonStatus[] = ["new", "changed", "expired", "removed", "unchanged"];
  const initialFilter = filterOrder.find((status) => opportunities.some((item) => item.status === status)) || "unchanged";

  return (
    <main className="min-h-screen bg-field">
      <SiteHeader rightSlot={<a href="/dashboard" className="text-sm font-semibold text-steel hover:text-accent">Dashboard</a>} />
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase text-accent">Monitoring intelligence</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">What changed since the previous scan</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Review new opportunities, meaningful record changes, expired deadlines, and signals no longer returned by the latest scan.
        </p>
        <ReportComparisonView
          className="mt-8"
          initialFilter={initialFilter}
          previousReport={{ label: previousScan.company_name || previousScan.company_url, href: `/reports/${previousScan.id}`, detail: dateLabel(previousScan.completed_at || previousScan.created_at) }}
          currentReport={{ label: currentScan.company_name || currentScan.company_url, href: `/reports/${currentScan.id}`, detail: dateLabel(currentScan.completed_at || currentScan.created_at) }}
          opportunities={opportunities}
        />
      </section>
    </main>
  );
}
