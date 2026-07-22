"use client";

import type { CustomerOpportunityPursuit } from "@/lib/pursuit-contract";
import { pursuitMethodLabel, pursuitStageLabel } from "@/lib/pursuit-contract";
import { DashboardEmptyState } from "./empty-state";
import { DashboardStatusBadge, type DashboardStatusTone } from "./status-badge";

export interface PursuitListProps {
  pursuits: CustomerOpportunityPursuit[];
}

function stageTone(stage: CustomerOpportunityPursuit["stage"]): DashboardStatusTone {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "submitted" || stage === "preparing") return "info";
  if (stage === "monitoring") return "warning";
  return "neutral";
}

function deadlineLabel(value: string | null): string {
  if (!value) return "No deadline set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function PursuitList({ pursuits }: PursuitListProps) {
  if (pursuits.length === 0) {
    return (
      <DashboardEmptyState
        title="No pursuits started"
        description="Open a full report and start a pursuit from an opportunity to track qualification, application requirements, ownership, and next steps."
        action={<a href="/dashboard?tab=reports" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">Open reports</a>}
      />
    );
  }

  return (
    <section aria-labelledby="pursuits-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pursuits-title" className="text-lg font-semibold text-ink">Pursuits</h2>
          <p className="mt-1 text-sm text-muted">Qualification, application, partner, and buyer work already in motion.</p>
        </div>
        <span className="text-sm font-medium text-muted">{pursuits.length} total</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(150px,1fr)_130px_minmax(160px,auto)] gap-4 border-b border-line bg-field px-5 py-3 text-xs font-semibold uppercase text-muted md:grid">
          <span>Opportunity</span><span>Route</span><span>Stage</span><span className="text-right">Next deadline</span>
        </div>
        <div className="divide-y divide-line">
          {pursuits.map((pursuit) => (
            <article key={pursuit.id} className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,2fr)_minmax(150px,1fr)_130px_minmax(160px,auto)] md:items-center md:px-5">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-ink">{pursuit.opportunity_title}</h3>
                <p className="mt-1 truncate text-xs text-muted">{pursuit.company_name} / {pursuit.target_organization || pursuit.source_name}</p>
                {pursuit.next_step ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{pursuit.next_step}</p> : null}
              </div>
              <p className="text-sm font-medium text-slate-700">{pursuitMethodLabel(pursuit.application_method)}</p>
              <div><DashboardStatusBadge tone={stageTone(pursuit.stage)}>{pursuitStageLabel(pursuit.stage)}</DashboardStatusBadge></div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span className="text-xs text-muted">{deadlineLabel(pursuit.deadline)}</span>
                <a href={`/opportunities/${pursuit.opportunity_id}?scanId=${pursuit.scan_id}`} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">Open</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
