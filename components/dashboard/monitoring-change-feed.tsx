import type { ReactNode } from "react";
import { DashboardStatusBadge, type DashboardStatusTone } from "./status-badge";

export type MonitoringChangeKind = "new" | "updated" | "closing" | "system";

export interface MonitoringChangeItem {
  id: string;
  title: string;
  summary: string;
  occurredLabel: string;
  sourceLabel?: string;
  searchName?: string;
  kind: MonitoringChangeKind;
  href?: string;
}

export interface MonitoringChangeFeedProps {
  items: MonitoringChangeItem[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  viewAllHref?: string;
}

const kindDisplay: Record<MonitoringChangeKind, { label: string; tone: DashboardStatusTone }> = {
  new: { label: "New signal", tone: "success" },
  updated: { label: "Updated", tone: "info" },
  closing: { label: "Closing soon", tone: "warning" },
  system: { label: "Monitoring", tone: "neutral" }
};

export function MonitoringChangeFeed({
  items,
  title = "Monitoring changes",
  description = "Recent changes across your active saved searches.",
  emptyMessage = "No changes detected yet. New and updated signals will appear here.",
  emptyAction,
  viewAllHref
}: MonitoringChangeFeedProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white" aria-labelledby="monitoring-feed-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="monitoring-feed-title" className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        {viewAllHref ? <a href={viewAllHref} className="text-sm font-semibold text-accent hover:text-[#0A6871]">View all</a> : null}
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm leading-6 text-muted">{emptyMessage}</p>
          {emptyAction ? <div className="mt-4 flex justify-center">{emptyAction}</div> : null}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => {
            const kind = kindDisplay[item.kind];
            const content = (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <DashboardStatusBadge tone={kind.tone}>{kind.label}</DashboardStatusBadge>
                  <span className="text-xs text-muted">{item.occurredLabel}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                {item.sourceLabel || item.searchName ? (
                  <p className="mt-2 text-xs font-medium text-muted">{[item.searchName, item.sourceLabel].filter(Boolean).join(" / ")}</p>
                ) : null}
              </>
            );
            return item.href ? (
              <a key={item.id} href={item.href} className="block px-5 py-4 hover:bg-field focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">{content}</a>
            ) : (
              <article key={item.id} className="px-5 py-4">{content}</article>
            );
          })}
        </div>
      )}
    </section>
  );
}
