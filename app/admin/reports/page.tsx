import { listAdminScansWithProfiles } from "@/lib/storage";
import { hasAdminAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(value?: string | null) {
  if (!value) {
    return "Not completed";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
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

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams?: { access?: string; resolution?: string };
}) {
  if (!hasAdminAccess(searchParams?.access)) return <AdminRequired />;

  const rows = await listAdminScansWithProfiles();
  const heldCount = rows.filter(({ scan }) => scan.status === "quality_review").length;
  const completedCount = rows.length - heldCount;
  const accessParam = `access=${encodeURIComponent(searchParams?.access ?? "")}`;
  const resolutionMessage =
    searchParams?.resolution === "published"
      ? "The held report was published and its completion email was processed."
      : searchParams?.resolution === "revision_requested"
        ? "The held report was closed and its revised-scan email was processed."
        : null;

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <a href="/" className="text-sm font-medium text-accent">
              Back to scan form
            </a>
            <a href={`/admin/sources?${accessParam}`} className="ml-4 text-sm font-medium text-accent">
              Source coverage
            </a>
            <a href={`/admin/feedback?${accessParam}`} className="ml-4 text-sm font-medium text-accent">
              Feedback
            </a>
            <h1 className="mt-4 text-3xl font-semibold text-ink">Report Review</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review held scans before release while keeping completed reports available for source
              coverage and opportunity-quality checks.
            </p>
          </div>
          <div className="rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-600">
            {heldCount} held / {completedCount} completed
          </div>
        </div>

        {resolutionMessage ? (
          <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {resolutionMessage}
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No completed or held scans yet. Run a scan from the form to populate this view.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {rows.map(({ scan, profile }) => {
                const isHeld = scan.status === "quality_review";
                return (
                  <article
                    key={scan.id}
                    className={`grid gap-4 p-5 md:grid-cols-[1fr_auto] ${isHeld ? "bg-amber-50/40" : ""}`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-ink">
                          {profile?.profile_json.company_name || scan.company_name || scan.company_url}
                        </h2>
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            isHeld
                              ? "bg-amber-100 text-amber-900"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {isHeld ? "Held for human review" : "completed"}
                        </span>
                        <span className="rounded-md bg-field px-2 py-1 text-xs font-medium text-slate-600">
                          {scan.report_type === "deep" ? "Deep Scan" : "Quick Scan"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{scan.company_url}</p>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                        {profile?.profile_json.summary || "Profile summary unavailable."}
                      </p>
                      {isHeld ? (
                        <div className="mt-4 max-w-3xl rounded-md border border-amber-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase text-amber-900">
                            Internal blocker summary
                          </p>
                          <p className="mt-1 break-words text-sm leading-6 text-slate-700">
                            {scan.error_message || "No blocker summary was recorded."}
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(profile?.profile_json.selected_playbooks ?? scan.selected_playbooks ?? [])
                          .slice(0, 3)
                          .map((playbook) => (
                            <span
                              key={playbook.playbook_id}
                              className="rounded-md bg-mist px-2 py-1 text-xs font-medium text-accent"
                            >
                              {playbook.name}
                            </span>
                          ))}
                        {(profile?.profile_json.public_sector_search_terms ||
                          profile?.profile_json.translated_public_sector_terms ||
                          [])
                          .slice(0, 8)
                          .map((term) => (
                            <span key={term} className="rounded-md bg-field px-2 py-1 text-xs text-ink">
                              {term}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex min-w-48 flex-col items-start gap-3 md:items-end">
                      <p className="text-sm text-slate-500">
                        {isHeld ? `Held ${formatDate(scan.created_at)}` : formatDate(scan.completed_at)}
                      </p>
                      <a
                        href={`/reports/${scan.id}?${accessParam}`}
                        className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:text-accent"
                      >
                        {isHeld ? "Inspect held report" : "View full report"}
                      </a>
                      {isHeld ? (
                        <div className="flex flex-wrap gap-2 md:max-w-48 md:justify-end">
                          <form
                            action={`/api/admin/scans/${encodeURIComponent(scan.id)}/quality-review`}
                            method="post"
                          >
                            <input type="hidden" name="access" value={searchParams?.access ?? ""} />
                            <input type="hidden" name="action" value="publish" />
                            <button
                              type="submit"
                              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
                            >
                              Publish report
                            </button>
                          </form>
                          <form
                            action={`/api/admin/scans/${encodeURIComponent(scan.id)}/quality-review`}
                            method="post"
                          >
                            <input type="hidden" name="access" value={searchParams?.access ?? ""} />
                            <input type="hidden" name="action" value="request_revision" />
                            <button
                              type="submit"
                              className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              Request revised scan
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
