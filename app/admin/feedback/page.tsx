import { AdminAccessState } from "@/components/admin/admin-access-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPage } from "@/lib/admin/page";
import { listReportFeedbackWithContext } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function opportunityHeadline(title?: string | null): string {
  if (!title) return "Scan-level feedback";
  const match = title.match(/^(.+?) received (\$[^:]+): (.+)$/);
  if (!match) return title;
  const [, recipient, amount, lane] = match;
  return `${lane}: ${recipient} funded ${amount}`;
}

function FeedbackBadge({ positive }: { positive: boolean }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
      positive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
    }`}>
      {positive ? "More like this" : "Less like this"}
    </span>
  );
}

export default async function AdminFeedbackPage({
  searchParams
}: {
  searchParams?: { access?: string };
}) {
  const access = await requireAdminPage("/admin/feedback", searchParams?.access);
  if (access.status !== "authorized") {
    return <AdminAccessState unavailable={access.status === "unavailable"} />;
  }

  const rows = await listReportFeedbackWithContext(150);
  const positiveCount = rows.filter((row) => row.feedback.feedback_kind === "more_like_this").length;
  const negativeCount = rows.length - positiveCount;

  return (
    <>
      <AdminPageHeader
        eyebrow="Customer signal"
        title="Feedback review"
        description="Review good-fit and bad-fit labels so query, connector, and playbook tuning can follow actual customer judgment."
        aside={
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
              {positiveCount} positive
            </span>
            <span className="rounded-md bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              {negativeCount} negative
            </span>
          </div>
        }
      />

      <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No feedback has been submitted yet.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-field text-xs uppercase text-slate-500">
                    <th className="px-4 py-3 font-semibold">Feedback</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Signal</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ feedback, scan, signal }) => {
                    const positive = feedback.feedback_kind === "more_like_this";
                    return (
                      <tr key={feedback.id} className="border-b border-line align-top last:border-0">
                        <td className="px-4 py-4"><FeedbackBadge positive={positive} /></td>
                        <td className="max-w-[180px] break-words px-4 py-4 text-slate-700">
                          {scan?.company_name || scan?.company_url || "Unknown scan"}
                        </td>
                        <td className="max-w-[280px] px-4 py-4">
                          <p className="font-semibold leading-6 text-ink">
                            {opportunityHeadline(signal?.opportunity_title)}
                          </p>
                          {signal ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {signal.source_name} / {signal.source_type.replaceAll("_", " ")}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-[260px] px-4 py-4 leading-6 text-slate-700">
                          {feedback.reason || "No reason provided."}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(feedback.created_at)}</td>
                        <td className="px-4 py-4">
                          <a
                            href={`/admin/reports/${feedback.scan_id}`}
                            className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:text-accent"
                          >
                            Inspect
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {rows.map(({ feedback, scan, signal }) => {
                const positive = feedback.feedback_kind === "more_like_this";
                return (
                  <article key={feedback.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FeedbackBadge positive={positive} />
                      <span className="text-xs text-slate-500">{formatDate(feedback.created_at)}</span>
                    </div>
                    <h2 className="mt-3 break-words text-sm font-semibold leading-6 text-ink">
                      {opportunityHeadline(signal?.opportunity_title)}
                    </h2>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {scan?.company_name || scan?.company_url || "Unknown scan"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {feedback.reason || "No reason provided."}
                    </p>
                    <a
                      href={`/admin/reports/${feedback.scan_id}`}
                      className="mt-4 inline-flex min-h-10 items-center rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:text-accent"
                    >
                      Inspect report
                    </a>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
