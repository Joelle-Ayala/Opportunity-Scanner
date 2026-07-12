"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";

export type ReportComparisonStatus = "new" | "changed" | "expired" | "removed" | "unchanged";

export interface ReportComparisonLink {
  label: string;
  href: string;
  detail?: string;
}

export interface ReportComparisonFieldChange {
  field: string;
  before?: string | null;
  after?: string | null;
}

export interface ReportComparisonOpportunity {
  id: string;
  title: string;
  agency: string;
  deadline?: string | null;
  source: string;
  sourceHref?: string;
  opportunityHref?: string;
  status: ReportComparisonStatus;
  changes?: ReportComparisonFieldChange[];
}

export interface ReportComparisonViewProps {
  currentReport: ReportComparisonLink;
  previousReport: ReportComparisonLink;
  opportunities: ReportComparisonOpportunity[];
  title?: string;
  description?: string;
  initialFilter?: ReportComparisonStatus;
  emptyMessage?: string;
  className?: string;
}

interface StatusDisplay {
  label: string;
  shortLabel: string;
  badgeClasses: string;
  activeClasses: string;
  countClasses: string;
}

const statusOrder: ReportComparisonStatus[] = ["new", "changed", "expired", "removed", "unchanged"];

const statusDisplay: Record<ReportComparisonStatus, StatusDisplay> = {
  new: {
    label: "New opportunities",
    shortLabel: "New",
    badgeClasses: "border-emerald-100 bg-emerald-50 text-emerald-700",
    activeClasses: "border-emerald-200 bg-emerald-50 text-emerald-800",
    countClasses: "bg-emerald-100 text-emerald-800"
  },
  changed: {
    label: "Changed opportunities",
    shortLabel: "Changed",
    badgeClasses: "border-cyan-100 bg-mist text-accent",
    activeClasses: "border-cyan-200 bg-mist text-accent",
    countClasses: "bg-cyan-100 text-accent"
  },
  expired: {
    label: "Expired opportunities",
    shortLabel: "Expired",
    badgeClasses: "border-amber-100 bg-amber-50 text-amber-800",
    activeClasses: "border-amber-200 bg-amber-50 text-amber-800",
    countClasses: "bg-amber-100 text-amber-800"
  },
  removed: {
    label: "Removed opportunities",
    shortLabel: "Removed",
    badgeClasses: "border-red-100 bg-red-50 text-red-700",
    activeClasses: "border-red-200 bg-red-50 text-red-700",
    countClasses: "bg-red-100 text-red-700"
  },
  unchanged: {
    label: "Unchanged opportunities",
    shortLabel: "Unchanged",
    badgeClasses: "border-line bg-field text-slate-600",
    activeClasses: "border-slate-300 bg-field text-ink",
    countClasses: "bg-slate-200 text-slate-700"
  }
};

function displayValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Not provided";
}

function ReportLink({ report, emphasis }: { report: ReportComparisonLink; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-muted">{emphasis ? "Current report" : "Previous report"}</p>
      <a
        href={report.href}
        className="mt-1 inline-block max-w-full truncate text-sm font-semibold text-ink underline decoration-line underline-offset-4 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {report.label}
      </a>
      {report.detail ? <p className="mt-1 truncate text-xs text-muted">{report.detail}</p> : null}
    </div>
  );
}

function ChangeDetails({ changes }: { changes: ReportComparisonFieldChange[] }) {
  if (changes.length === 0) {
    return <p className="mt-3 text-sm text-muted">The record changed, but no field details were provided.</p>;
  }

  return (
    <dl className="mt-4 divide-y divide-line border-y border-line">
      {changes.map((change, index) => (
        <div key={`${change.field}-${index}`} className="grid gap-2 py-3 sm:grid-cols-[minmax(120px,0.65fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-3">
          <dt className="text-xs font-semibold uppercase text-muted">{change.field}</dt>
          <dd className="min-w-0 break-words text-sm leading-5 text-slate-500">
            <span className="mr-2 text-xs font-semibold text-muted sm:hidden">Before</span>
            {displayValue(change.before)}
          </dd>
          <span className="hidden pt-0.5 text-sm text-muted sm:block" aria-hidden="true">{"->"}</span>
          <dd className="min-w-0 break-words text-sm font-medium leading-5 text-ink">
            <span className="mr-2 text-xs font-semibold text-muted sm:hidden">After</span>
            {displayValue(change.after)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OpportunityRow({ opportunity }: { opportunity: ReportComparisonOpportunity }) {
  const display = statusDisplay[opportunity.status];

  return (
    <article className="px-4 py-5 sm:px-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_90px] md:items-start md:gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3 md:block">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-5 text-ink">
              {opportunity.opportunityHref ? (
                <a
                  href={opportunity.opportunityHref}
                  className="rounded-sm underline decoration-line underline-offset-4 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {opportunity.title}
                </a>
              ) : opportunity.title}
            </h3>
            <p className="mt-1 text-xs text-muted md:hidden">{opportunity.agency}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-semibold md:hidden ${display.badgeClasses}`}>
            {display.shortLabel}
          </span>
        </div>
        <p className="hidden min-w-0 break-words text-sm text-slate-700 md:block">{opportunity.agency}</p>
        <p className="text-sm text-slate-700">
          <span className="mr-2 text-xs font-semibold text-muted md:hidden">Deadline</span>
          {displayValue(opportunity.deadline)}
        </p>
        <div className="min-w-0 text-sm">
          <span className="mr-2 text-xs font-semibold text-muted md:hidden">Source</span>
          {opportunity.sourceHref ? (
            <a
              href={opportunity.sourceHref}
              className="break-words font-medium text-accent underline decoration-cyan-200 underline-offset-4 hover:text-[#0A6871] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {opportunity.source}
            </a>
          ) : (
            <span className="break-words text-slate-700">{opportunity.source}</span>
          )}
        </div>
        <div className="hidden md:block">
          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${display.badgeClasses}`}>
            {display.shortLabel}
          </span>
        </div>
      </div>
      {(opportunity.changes?.length ?? 0) > 0 ? <ChangeDetails changes={opportunity.changes ?? []} /> : null}
    </article>
  );
}

export function ReportComparisonView({
  currentReport,
  previousReport,
  opportunities,
  title = "Report comparison",
  description = "Review what changed between these two opportunity reports.",
  initialFilter = "new",
  emptyMessage = "No opportunities match this comparison filter.",
  className = ""
}: ReportComparisonViewProps) {
  const [activeFilter, setActiveFilter] = useState<ReportComparisonStatus>(initialFilter);
  const instanceId = useId().replace(/:/g, "");
  const counts = useMemo(
    () =>
      opportunities.reduce<Record<ReportComparisonStatus, number>>(
        (result, opportunity) => {
          result[opportunity.status] += 1;
          return result;
        },
        { new: 0, changed: 0, expired: 0, removed: 0, unchanged: 0 }
      ),
    [opportunities]
  );
  const visibleOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.status === activeFilter),
    [activeFilter, opportunities]
  );
  const activeDisplay = statusDisplay[activeFilter];
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, status: ReportComparisonStatus) => {
    const currentIndex = statusOrder.indexOf(status);
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % statusOrder.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + statusOrder.length) % statusOrder.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = statusOrder.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextStatus = statusOrder[nextIndex];
    setActiveFilter(nextStatus);
    document.getElementById(`${instanceId}-${nextStatus}-tab`)?.focus();
  };

  return (
    <section className={className} aria-labelledby={`${instanceId}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${instanceId}-title`} className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
        <p className="text-sm font-medium text-muted">{opportunities.length} total opportunities</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <div className="grid gap-4 border-b border-line bg-field px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:px-5">
          <ReportLink report={previousReport} />
          <span className="hidden text-sm font-medium text-muted sm:block" aria-hidden="true">{"->"}</span>
          <ReportLink report={currentReport} emphasis />
        </div>

        <div className="border-b border-line px-3 py-3 sm:px-5">
          <div className="grid grid-cols-2 gap-2 sm:flex" role="tablist" aria-label="Filter comparison results">
            {statusOrder.map((status) => {
              const display = statusDisplay[status];
              const selected = activeFilter === status;
              return (
                <button
                  key={status}
                  id={`${instanceId}-${status}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${instanceId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveFilter(status)}
                  onKeyDown={(event) => handleTabKeyDown(event, status)}
                  aria-label={`${display.label}, ${counts[status]}`}
                  className={`flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:justify-start ${
                    selected ? display.activeClasses : "border-transparent bg-white text-muted hover:border-line hover:bg-field hover:text-ink"
                  }`}
                >
                  <span>{display.shortLabel}</span>
                  <span className={`inline-flex min-w-6 justify-center rounded-md px-1.5 py-0.5 text-xs ${selected ? display.countClasses : "bg-field text-muted"}`}>
                    {counts[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          id={`${instanceId}-panel`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-${activeFilter}-tab`}
          tabIndex={0}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_90px] gap-4 border-b border-line bg-field px-5 py-3 text-xs font-semibold uppercase text-muted md:grid">
            <span>Opportunity</span>
            <span>Agency</span>
            <span>Deadline</span>
            <span>Source</span>
            <span>Status</span>
          </div>
          {visibleOpportunities.length > 0 ? (
            <div className="divide-y divide-line">
              {visibleOpportunities.map((opportunity) => <OpportunityRow key={opportunity.id} opportunity={opportunity} />)}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-ink">No {activeDisplay.shortLabel.toLowerCase()} opportunities</p>
              <p className="mt-1 text-sm leading-6 text-muted">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
