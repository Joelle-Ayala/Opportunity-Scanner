import { isSamGovConfigured } from "@/lib/connectors/samGov";
import { sourceCatalog } from "@/lib/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AdminSourcesPage() {
  const sources = sourceCatalog({ samGovConfigured: isSamGovConfigured() });

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <a href="/admin/reports" className="text-sm font-medium text-accent">
              Back to completed scans
            </a>
            <h1 className="mt-4 text-3xl font-semibold text-ink">Source Coverage</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Connector status for the opportunity engine. Add one source at a time, test report
              quality, tune playbooks, then move to the next source.
            </p>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-field text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Key</th>
                <th className="px-4 py-3 font-semibold">Value</th>
                <th className="px-4 py-3 font-semibold">Next Test</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.name} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-4 font-semibold text-ink">{source.name}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        source.status === "Active"
                          ? "bg-green-50 text-green-700"
                          : source.status === "Needs API key"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-field text-slate-700"
                      }`}
                    >
                      {source.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{source.key}</td>
                  <td className="max-w-[260px] px-4 py-4 leading-6 text-slate-700">{source.value}</td>
                  <td className="max-w-[320px] px-4 py-4 leading-6 text-slate-700">{source.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
