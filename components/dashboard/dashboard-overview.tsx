import type { ReactNode } from "react";
import { MonitoringChangeFeed, type MonitoringChangeItem } from "./monitoring-change-feed";
import { ReportList, type DashboardReportRow } from "./report-list";
import { UsageSummary, type DashboardUsageMetric } from "./usage-summary";

export interface DashboardOverviewMetric {
  id: string;
  label: string;
  value: string | number;
  context?: string;
  tone?: "default" | "positive" | "attention";
}

export interface DashboardOverviewProps {
  metrics: DashboardOverviewMetric[];
  planName: string;
  planDescription?: string;
  renewalLabel?: string;
  usage: DashboardUsageMetric[];
  recentReports: DashboardReportRow[];
  monitoringChanges: MonitoringChangeItem[];
  usageAction?: ReactNode;
  reportEmptyAction?: ReactNode;
  reportsHref?: string;
  monitoringHref?: string;
  onViewReport?: (report: DashboardReportRow) => void;
  onRetryReport?: (report: DashboardReportRow) => void;
  onDownloadReport?: (report: DashboardReportRow) => void;
}

const metricValueClasses = {
  default: "text-ink",
  positive: "text-signal",
  attention: "text-review"
};

export function DashboardOverview({
  metrics,
  planName,
  planDescription,
  renewalLabel,
  usage,
  recentReports,
  monitoringChanges,
  usageAction,
  reportEmptyAction,
  reportsHref,
  monitoringHref,
  onViewReport,
  onRetryReport,
  onDownloadReport
}: DashboardOverviewProps) {
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-lg border border-line bg-white" aria-label="Workspace summary">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="min-w-0 px-5 py-4">
              <p className="text-sm font-medium text-muted">{metric.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${metricValueClasses[metric.tone || "default"]}`}>{metric.value}</p>
              {metric.context ? <p className="mt-1 truncate text-xs text-muted">{metric.context}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <UsageSummary
        planName={planName}
        planDescription={planDescription}
        renewalLabel={renewalLabel}
        metrics={usage}
        action={usageAction}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] xl:items-start">
        <ReportList
          reports={recentReports}
          title="Recent reports"
          description="Latest scans across your workspace."
          emptyAction={reportEmptyAction}
          onView={onViewReport}
          onRetry={onRetryReport}
          onDownload={onDownloadReport}
        />
        <MonitoringChangeFeed items={monitoringChanges} viewAllHref={monitoringHref} />
      </div>

      {reportsHref && recentReports.length > 0 ? (
        <div className="flex justify-end">
          <a href={reportsHref} className="text-sm font-semibold text-accent hover:text-[#0A6871]">View all reports</a>
        </div>
      ) : null}
    </div>
  );
}
