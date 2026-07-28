import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin/admin-access-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPage } from "@/lib/admin/page";
import {
  getCompanyProfile,
  getScan,
  listScanOpportunitySignals
} from "@/lib/storage";
import { classifyOpportunityRecord } from "@/lib/opportunityRecordClassification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function AdminReportInspectionPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { access?: string };
}) {
  const nextPath = `/admin/reports/${encodeURIComponent(params.id)}`;
  const access = await requireAdminPage(nextPath, searchParams?.access);
  if (access.status !== "authorized") {
    return <AdminAccessState unavailable={access.status === "unavailable"} />;
  }

  const [scan, profile, signals] = await Promise.all([
    getScan(params.id),
    getCompanyProfile(params.id),
    listScanOpportunitySignals(params.id)
  ]);
  if (!scan) notFound();
  const visibleSignals = signals.filter((signal) => signal.show_in_report !== false);
  const isHeld = scan.status === "quality_review";

  return (
    <>
      <a href="/admin/reports" className="text-sm font-semibold text-accent hover:text-[#0A6871]">
        Back to report review
      </a>
      <div className="mt-4">
        <AdminPageHeader
          eyebrow={isHeld ? "Held for review" : "Report inspection"}
          title={profile?.profile_json.company_name || scan.company_name || "Opportunity report"}
          description={profile?.profile_json.summary || "No company profile summary is available."}
          aside={
            <span className={`rounded-md px-3 py-2 text-sm font-semibold ${
              isHeld ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-700"
            }`}>
              {isHeld ? "Human review required" : scan.status.replaceAll("_", " ")}
            </span>
          }
        />
      </div>

      {isHeld ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Why this report was held</h2>
          <p className="mt-2 break-words text-sm leading-6 text-slate-700">
            {scan.error_message || "No blocker summary was recorded."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={`/api/admin/scans/${encodeURIComponent(scan.id)}/quality-review`} method="post">
              <input type="hidden" name="access" value={searchParams?.access ?? ""} />
              <input type="hidden" name="action" value="publish" />
              <button type="submit" className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A6871]">
                Publish report
              </button>
            </form>
            <form action={`/api/admin/scans/${encodeURIComponent(scan.id)}/quality-review`} method="post">
              <input type="hidden" name="access" value={searchParams?.access ?? ""} />
              <input type="hidden" name="action" value="request_revision" />
              <button type="submit" className="min-h-11 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Close as needs revision
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Opportunity action review</h2>
            <p className="mt-1 text-sm text-slate-600">
              {visibleSignals.length} customer-visible opportunities
            </p>
          </div>
        </div>
        {visibleSignals.length === 0 ? (
          <div className="mt-4 rounded-lg border border-line bg-white p-5 text-sm text-slate-600">
            No customer-visible opportunities were stored for this report.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
            {visibleSignals.map((signal) => {
              const sourceUrl = safeSourceUrl(signal.source_url);
              const record = classifyOpportunityRecord({
                recordClass: signal.record_class,
                currentValidatedAt: signal.current_validated_at,
                sourceName: signal.source_name,
                sourceType: signal.source_type,
                deadline: signal.deadline,
                awardYear: signal.award_year,
                periodEnd: signal.period_end
              });
              return (
                <article key={signal.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold text-ink">
                        {signal.opportunity_title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {signal.source_name} / {signal.source_type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="rounded-md bg-field px-2 py-1 text-xs font-semibold text-slate-700">
                      {signal.actionability_label || signal.actionability}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Why it matters</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{signal.why_it_matters}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Next action</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {signal.next_best_action || signal.best_next_step}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                    <span>Buyer or partner: {signal.target_organization || signal.likely_buyer_or_partner}</span>
                    <span>
                      {record.recordClass === "current"
                        ? `Deadline: ${record.deadline}`
                        : record.awardYear
                          ? `Award year: ${record.awardYear}`
                          : `Period of performance: ${record.periodEnd || "Historical record"}`}
                    </span>
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent hover:text-[#0A6871]"
                      >
                        Open official source
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
