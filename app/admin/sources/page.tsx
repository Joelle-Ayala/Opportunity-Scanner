import { AdminAccessState } from "@/components/admin/admin-access-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPage } from "@/lib/admin/page";
import { isSamGovConfigured } from "@/lib/connectors/samGov";
import { sourceCatalog } from "@/lib/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function statusTone(status: string): string {
  if (status === "Active") return "bg-emerald-50 text-emerald-700";
  if (status === "Needs API key") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default async function AdminSourcesPage({
  searchParams
}: {
  searchParams?: { access?: string };
}) {
  const access = await requireAdminPage("/admin/sources", searchParams?.access);
  if (access.status !== "authorized") {
    return <AdminAccessState unavailable={access.status === "unavailable"} />;
  }

  const sources = sourceCatalog({ samGovConfigured: isSamGovConfigured() });
  const activeCount = sources.filter((source) => source.status === "Active").length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Connectors"
        title="Source configuration"
        description="A configuration view of the sources available to the opportunity engine. Runtime performance requires additional aggregate health data."
        aside={
          <div className="rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-600">
            {activeCount} active / {sources.length} total
          </div>
        }
      />

      <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-field text-xs uppercase text-slate-500">
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Configuration</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Next check</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-4 font-semibold text-ink">{source.name}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone(source.status)}`}>
                      {source.status}
                    </span>
                  </td>
                  <td className="max-w-[180px] break-words px-4 py-4 text-slate-700">{source.key}</td>
                  <td className="max-w-[280px] px-4 py-4 leading-6 text-slate-700">{source.value}</td>
                  <td className="max-w-[300px] px-4 py-4 leading-6 text-slate-700">{source.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-line md:hidden">
          {sources.map((source) => (
            <article key={source.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{source.name}</h2>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone(source.status)}`}>
                  {source.status}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Configuration</dt>
                  <dd className="mt-1 break-words text-slate-700">{source.key}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Role</dt>
                  <dd className="mt-1 leading-6 text-slate-700">{source.value}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Next check</dt>
                  <dd className="mt-1 leading-6 text-slate-700">{source.next}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
