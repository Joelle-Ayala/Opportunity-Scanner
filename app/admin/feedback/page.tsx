import { listReportFeedbackWithContext } from "@/lib/storage";
import { hasAdminAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function opportunityHeadline(title?: string | null): string {
  if (!title) return "Scan-level feedback";
  const match = title.match(/^(.+?) received (\$[^:]+): (.+)$/);
  if (match) {
    const [, recipient, amount, lane] = match;
    return `${lane}: ${recipient} funded ${amount}`;
  }
  return title;
}

function AdminRequired() {
  return (
    <main className="min-h-screen bg-field px-6 py-8">
      <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This workspace is only available to approved Opportunity Scanner operators.
        </p>
      </section>
    </main>
  );
}

export default async function AdminFeedbackPage({
  searchParams
}: {
  searchParams?: { access?: string };
}) {
  if (!hasAdminAccess(searchParams?.access)) return <AdminRequired />;

  const rows = await listReportFeedbackWithContext(150);
  const moreLikeThis = rows.filter((row) => row.feedback.feedback_kind === "more_like_this").length;
  const lessLikeThis = rows.filter((row) => row.feedback.feedback_kind === "less_like_this").length;
  const accessParam = `access=${encodeURIComponent(searchParams?.access ?? "")}`;

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <a href={`/admin/reports?${accessParam}`} className="text-sm font-medium text-accent">
              Back to completed scans
            </a>
            <a href={`/admin/sources?${accessParam}`} className="ml-4 text-sm font-medium text-accent">
              Source coverage
            </a>
            <h1 className="mt-4 text-3xl font-semibold text-ink">Feedback Review</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review good-fit and bad-fit labels so future playbook, query, and connector tuning can
              follow actual user judgment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-green-50 px-3 py-2 font-semibold text-green-700">
              {moreLikeThis} more like this
            </span>
            <span className="rounded-md bg-slate-100 px-3 py-2 font-semibold text-slate-700">
              {lessLikeThis} less like this
            </span>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No feedback has been submitted yet.
            </div>
          ) : (
            <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-field text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Feedback</th>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Signal</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Links</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ feedback, scan, signal }) => (
                  <tr key={feedback.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          feedback.feedback_kind === "more_like_this"
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {feedback.feedback_kind === "more_like_this" ? "More like this" : "Less like this"}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-4 py-4 text-slate-700">
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
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/reports/${feedback.scan_id}?${accessParam}`}
                          className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          Report
                        </a>
                        {feedback.opportunity_id ? (
                          <a
                            href={`/opportunities/${feedback.opportunity_id}?scanId=${feedback.scan_id}&${accessParam}`}
                            className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                          >
                            Opportunity
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
