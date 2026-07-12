"use client";

import type { ReactNode } from "react";
import { DashboardEmptyState } from "./empty-state";
import { DashboardStatusBadge, type DashboardStatusTone } from "./status-badge";

export type DashboardReportStatus = "queued" | "scanning" | "ready" | "failed";

export interface DashboardReportRow {
  id: string;
  companyName: string;
  companyUrl?: string;
  createdLabel: string;
  status: DashboardReportStatus;
  signalCount?: number;
  reportType?: string;
  href?: string;
}

export interface ReportListProps {
  reports: DashboardReportRow[];
  title?: string;
  description?: string;
  emptyAction?: ReactNode;
  onView?: (report: DashboardReportRow) => void;
  onRetry?: (report: DashboardReportRow) => void;
  onDownload?: (report: DashboardReportRow) => void;
  renderMenu?: (report: DashboardReportRow) => ReactNode;
}

const statusDisplay: Record<DashboardReportStatus, { label: string; tone: DashboardStatusTone }> = {
  queued: { label: "Queued", tone: "neutral" },
  scanning: { label: "Scanning", tone: "info" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Needs retry", tone: "danger" }
};

function Initials({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-field text-xs font-semibold text-ink" aria-hidden="true">
      {initials || "CO"}
    </span>
  );
}

export function ReportList({
  reports,
  title = "Reports",
  description = "Review completed scans and continue work on active opportunities.",
  emptyAction,
  onView,
  onRetry,
  onDownload,
  renderMenu
}: ReportListProps) {
  if (reports.length === 0) {
    return (
      <DashboardEmptyState
        title="No reports yet"
        description="Run your first company scan to build a sourced opportunity report."
        action={emptyAction}
        icon={<span className="text-sm font-bold">+</span>}
      />
    );
  }

  return (
    <section aria-labelledby="reports-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reports-title" className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <span className="text-sm font-medium text-muted">{reports.length} total</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_120px_minmax(180px,auto)] gap-4 border-b border-line bg-field px-5 py-3 text-xs font-semibold uppercase text-muted md:grid">
          <span>Company</span><span>Report</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-line">
          {reports.map((report) => {
            const status = statusDisplay[report.status];
            return (
              <article key={report.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_120px_minmax(180px,auto)] md:items-center md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Initials name={report.companyName} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{report.companyName}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted">{report.companyUrl || report.createdLabel}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm md:block">
                  <p className="font-medium text-slate-700">{report.reportType || "Opportunity report"}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[report.createdLabel, typeof report.signalCount === "number" ? `${report.signalCount} signals` : ""]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>
                <div><DashboardStatusBadge tone={status.tone}>{status.label}</DashboardStatusBadge></div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {report.status === "failed" && onRetry ? (
                    <button type="button" onClick={() => onRetry(report)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Retry</button>
                  ) : null}
                  {report.status === "ready" && onDownload ? (
                    <button type="button" onClick={() => onDownload(report)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">Export</button>
                  ) : null}
                  {report.href ? (
                    <a href={report.href} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">View report</a>
                  ) : onView ? (
                    <button type="button" onClick={() => onView(report)} disabled={report.status !== "ready"} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300">View report</button>
                  ) : null}
                  {renderMenu ? renderMenu(report) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
