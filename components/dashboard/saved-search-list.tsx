"use client";

import type { ReactNode } from "react";
import { trackProductEvent } from "@/lib/productAnalytics";
import { DashboardEmptyState } from "./empty-state";
import { DashboardStatusBadge } from "./status-badge";

export type MonitoredSearchStatus = "active" | "paused" | "attention" | "archived";

export interface SavedSearchCriteria {
  companyUrl: string;
  industry: string;
  targetStates: string;
  customerType: string;
  opportunityFocus: string;
  includeTerms: string;
  excludeTerms: string;
}

export interface MonitoredSearchRow {
  id: string;
  name: string;
  querySummary: string;
  cadence: string;
  status: MonitoredSearchStatus;
  lastRunLabel?: string;
  nextRunLabel?: string;
  newSignalCount?: number;
  currentVersion?: number;
  criteria: SavedSearchCriteria;
}

export interface SavedSearchListProps {
  searches: MonitoredSearchRow[];
  title?: string;
  description?: string;
  emptyAction?: ReactNode;
  addMonitoringAction?: ReactNode;
  monitoringCapacity?: {
    used: number;
    limit: number;
  };
  capacityAction?: ReactNode;
  onOpen?: (search: MonitoredSearchRow) => void;
  onToggleStatus?: (search: MonitoredSearchRow) => void;
  onEdit?: (search: MonitoredSearchRow) => void;
  renderMenu?: (search: MonitoredSearchRow) => ReactNode;
}

const statusDisplay = {
  active: { label: "Monitoring", tone: "success" as const },
  paused: { label: "Paused", tone: "neutral" as const },
  attention: { label: "Check setup", tone: "warning" as const },
  archived: { label: "Archived", tone: "neutral" as const }
};

const inputClassName = "rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function SavedSearchList({
  searches,
  title = "Saved searches",
  description = "Track recurring public-sector signals without starting from scratch.",
  emptyAction,
  addMonitoringAction,
  monitoringCapacity,
  capacityAction,
  onOpen,
  onToggleStatus,
  onEdit,
  renderMenu
}: SavedSearchListProps) {
  if (searches.length === 0) {
    return (
      <DashboardEmptyState
        title="No saved searches"
        description="Save a focused search to monitor new funding, procurement, and money-flow signals."
        action={emptyAction}
        icon={<span className="text-sm font-bold">+</span>}
      />
    );
  }

  const monitoringLimitReached = Boolean(
    monitoringCapacity && monitoringCapacity.used >= monitoringCapacity.limit
  );

  return (
    <section aria-labelledby="saved-searches-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="saved-searches-title" className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {monitoringCapacity ? (
            <span className="text-sm font-medium text-muted">
              {monitoringCapacity.used} of {monitoringCapacity.limit} monitored
            </span>
          ) : (
            <span className="text-sm font-medium text-muted">{searches.length} saved</span>
          )}
          {monitoringLimitReached ? (
            <>
              <span role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                Plan limit reached
              </span>
              {capacityAction}
            </>
          ) : addMonitoringAction}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_130px_minmax(180px,auto)] gap-4 border-b border-line bg-field px-5 py-3 text-xs font-semibold uppercase text-muted md:grid">
          <span>Search</span><span>Schedule</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-line">
          {searches.map((search) => {
            const status = statusDisplay[search.status];
            return (
              <article key={search.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_130px_minmax(180px,auto)] md:items-center md:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{search.name}</h3>
                    {search.newSignalCount ? (
                      <span className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold text-accent">
                        {search.newSignalCount} new
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{search.querySummary}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{search.cadence}</p>
                  <p className="mt-0.5 text-xs text-muted">{search.nextRunLabel || search.lastRunLabel || "Schedule pending"}</p>
                </div>
                <div><DashboardStatusBadge tone={status.tone}>{status.label}</DashboardStatusBadge></div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {search.status === "active" ? (
                    <form action={`/api/dashboard/searches/${search.id}`} method="post" onSubmit={() => trackProductEvent("saved_search_run_requested", { source: "dashboard" })}>
                      <input type="hidden" name="action" value="run" />
                      <button className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                        Run now
                      </button>
                    </form>
                  ) : null}
                  {search.status === "active" || search.status === "paused" ? (
                    <form action={`/api/dashboard/searches/${search.id}`} method="post" onSubmit={() => trackProductEvent("saved_search_status_changed", { status: search.status === "paused" ? "active" : "paused" })}>
                      <input type="hidden" name="action" value={search.status === "paused" ? "resume" : "pause"} />
                      <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {search.status === "paused" ? "Resume" : "Pause"}
                      </button>
                    </form>
                  ) : null}
                  {onToggleStatus ? (
                    <button type="button" onClick={() => { trackProductEvent("saved_search_status_changed", { status: search.status === "paused" ? "active" : "paused" }); onToggleStatus(search); }} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      {search.status === "paused" ? "Resume" : "Pause"}
                    </button>
                  ) : null}
                  {onEdit ? (
                    <button type="button" onClick={() => onEdit(search)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Edit</button>
                  ) : null}
                  {onOpen ? (
                    <button type="button" onClick={() => onOpen(search)} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">View results</button>
                  ) : null}
                  {renderMenu ? renderMenu(search) : null}
                </div>
                {search.status !== "archived" ? (
                  <div className="md:col-span-4">
                    <details className="group border-t border-line pt-3">
                      <summary className="w-fit cursor-pointer text-sm font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        Edit search
                      </summary>
                      <form action={`/api/dashboard/searches/${search.id}`} method="post" onSubmit={() => trackProductEvent("saved_search_changed", { change_type: "criteria" })} className="mt-4 grid gap-4 rounded-md bg-field p-4 sm:grid-cols-2">
                        <input type="hidden" name="action" value="edit" />
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Search name</span>
                          <input required maxLength={120} name="name" defaultValue={search.name} className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Company website</span>
                          <input required type="url" maxLength={2048} name="companyUrl" defaultValue={search.criteria.companyUrl} className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Industry</span>
                          <input maxLength={160} name="industry" defaultValue={search.criteria.industry} className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Target geography</span>
                          <input maxLength={500} name="targetStates" defaultValue={search.criteria.targetStates} placeholder="National, MD, CA" className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Customer type</span>
                          <input maxLength={120} name="customerType" defaultValue={search.criteria.customerType} className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5 sm:col-span-2">
                          <span className="text-sm font-semibold text-ink">Opportunity focus</span>
                          <textarea rows={3} maxLength={2000} name="opportunityFocus" defaultValue={search.criteria.opportunityFocus} className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Include terms</span>
                          <input maxLength={1000} name="includeTerms" defaultValue={search.criteria.includeTerms} className={inputClassName} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-sm font-semibold text-ink">Exclude terms</span>
                          <input maxLength={1000} name="excludeTerms" defaultValue={search.criteria.excludeTerms} className={inputClassName} />
                        </label>
                        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                          <button className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                            Save new version
                          </button>
                          {search.currentVersion ? <span className="text-xs text-muted">Current version: {search.currentVersion}</span> : null}
                        </div>
                      </form>
                    </details>
                    <details className="mt-3 border-t border-line pt-3">
                      <summary className="w-fit cursor-pointer text-sm font-semibold text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                        Archive search
                      </summary>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <p className="text-sm text-muted">Archive this search and stop its monitoring schedule?</p>
                        <form action={`/api/dashboard/searches/${search.id}`} method="post" onSubmit={() => trackProductEvent("saved_search_status_changed", { status: "archived" })}>
                          <input type="hidden" name="action" value="archive" />
                          <button className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                            Confirm archive
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
