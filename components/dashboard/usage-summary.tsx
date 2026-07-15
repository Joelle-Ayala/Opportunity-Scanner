import type { ReactNode } from "react";

export interface DashboardUsageMetric {
  id: string;
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
  remaining?: number;
  unlimitedLabel?: string;
}

export interface UsageSummaryProps {
  planName: string;
  planDescription?: string;
  renewalLabel?: string;
  metrics: DashboardUsageMetric[];
  action?: ReactNode;
}

function metricValue(metric: DashboardUsageMetric): string {
  const suffix = metric.unit ? ` ${metric.unit}` : "";
  if (metric.remaining !== undefined && metric.limit !== null) {
    return `${metric.remaining.toLocaleString()} remaining of ${metric.limit.toLocaleString()}${suffix}`;
  }
  return metric.limit === null
    ? `${metric.used.toLocaleString()}${suffix}`
    : `${metric.used.toLocaleString()} of ${metric.limit.toLocaleString()}${suffix}`;
}

export function UsageSummary({
  planName,
  planDescription,
  renewalLabel,
  metrics,
  action
}: UsageSummaryProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white" aria-labelledby="usage-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Current plan</p>
          <h2 id="usage-summary-title" className="mt-1 text-lg font-semibold text-ink">{planName}</h2>
          {planDescription ? <p className="mt-1 text-sm text-muted">{planDescription}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {renewalLabel ? <span className="text-sm text-muted">{renewalLabel}</span> : null}
          {action}
        </div>
      </div>
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
        {metrics.map((metric) => {
          const percentage = metric.limit && metric.limit > 0
            ? Math.min(100, Math.round(((metric.remaining ?? metric.used) / metric.limit) * 100))
            : null;
          return (
            <div key={metric.id} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                {percentage !== null ? <span className="text-xs font-semibold text-muted">{percentage}%</span> : null}
              </div>
              <p className="mt-2 text-xl font-semibold text-ink">{metricValue(metric)}</p>
              {percentage !== null ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${percentage}%` }} />
                </div>
              ) : (
                metric.unlimitedLabel ? <p className="mt-3 text-xs font-medium text-signal">{metric.unlimitedLabel}</p> : null
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
