"use client";

import type { ReactNode } from "react";
import { DashboardEmptyState } from "./empty-state";
import { DashboardStatusBadge } from "./status-badge";

export type MonitoredSearchStatus = "active" | "paused" | "attention";

export interface MonitoredSearchRow {
  id: string;
  name: string;
  querySummary: string;
  cadence: string;
  status: MonitoredSearchStatus;
  lastRunLabel?: string;
  nextRunLabel?: string;
  newSignalCount?: number;
}

export interface SavedSearchListProps {
  searches: MonitoredSearchRow[];
  title?: string;
  description?: string;
  emptyAction?: ReactNode;
  onOpen?: (search: MonitoredSearchRow) => void;
  onToggleStatus?: (search: MonitoredSearchRow) => void;
  onEdit?: (search: MonitoredSearchRow) => void;
  renderMenu?: (search: MonitoredSearchRow) => ReactNode;
}

const statusDisplay = {
  active: { label: "Monitoring", tone: "success" as const },
  paused: { label: "Paused", tone: "neutral" as const },
  attention: { label: "Check setup", tone: "warning" as const }
};

export function SavedSearchList({
  searches,
  title = "Saved searches",
  description = "Track recurring public-sector signals without starting from scratch.",
  emptyAction,
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

  return (
    <section aria-labelledby="saved-searches-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="saved-searches-title" className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <span className="text-sm font-medium text-muted">{searches.length} saved</span>
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
                  {onToggleStatus ? (
                    <button type="button" onClick={() => onToggleStatus(search)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
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
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
