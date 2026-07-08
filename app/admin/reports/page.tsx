import { listCompletedScansWithProfiles } from "@/lib/storage";
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
  searchParams?: { access?: string };
}) {
  if (!hasAdminAccess(searchParams?.access)) return <AdminRequired />;

  const rows = await listCompletedScansWithProfiles();
  const accessParam = `access=${encodeURIComponent(searchParams?.access ?? "")}`;

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
            <h1 className="mt-4 text-3xl font-semibold text-ink">Completed Scans</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Admin view for reviewing completed scans, source coverage, opportunity signals, and
              search strategy details.
            </p>
          </div>
          <div className="rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-600">
            {rows.length} completed
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No completed scans yet. Run a scan from the form to populate this view.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {rows.map(({ scan, profile }) => (
                <article key={scan.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink">
                        {profile?.profile_json.company_name || scan.company_name || scan.company_url}
                      </h2>
                      <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        {scan.status}
                      </span>
                      <span className="rounded-md bg-field px-2 py-1 text-xs font-medium text-slate-600">
                        {scan.report_type === "deep" ? "Deep Scan" : "Quick Scan"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{scan.company_url}</p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                      {profile?.profile_json.summary || "Profile summary unavailable."}
                    </p>
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
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <p className="text-sm text-slate-500">{formatDate(scan.completed_at)}</p>
                    <a
                      href={`/reports/${scan.id}?${accessParam}`}
                      className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
                    >
                      View full report
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
