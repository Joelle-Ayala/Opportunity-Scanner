import { Badge, CompanyLogo } from "@/components/brand";
import type { IndustrySampleReport } from "@/lib/sampleReports";

const CIVICSTAGE_SLUG = "creative-economy-live-events-opportunity-scan";

const civicStageProfile = [
  ["Offer", "Curated artist, performer, teaching-artist, and cultural-programming marketplace"],
  ["Likely buyers", "Cities, schools, venues, parks, tourism offices, and funded cultural organizations"],
  ["Search language", "Public events, arts education, placemaking, cultural programming, tourism, and creative workforce"],
  ["Revenue paths", "Sell to Agency, Sell to Funded Buyer, Partner with Recipient, and Monitor"]
] as const;

const civicStageJourney = [
  {
    label: "1. Qualify",
    title: "Review source and fit",
    copy: "Open the official record, confirm timing and eligibility, and keep the source evidence attached to the row."
  },
  {
    label: "2. Pursue",
    title: "Use the right route",
    copy: "For this recipient-funded signal, save a partnership pursuit and route outreach to programming or partnerships leadership."
  },
  {
    label: "3. Monitor",
    title: "Keep the search current",
    copy: "Save the qualified company profile and watch relevant arts, tourism, parks, education, and event terms on the plan cadence."
  },
  {
    label: "4. Move",
    title: "Send structured context",
    copy: "Export the row or send its source, target, revenue motion, contact strategy, and next action to a secure workflow endpoint."
  }
] as const;

export function SampleReportPreview({ report }: { report: IndustrySampleReport }) {
  const topRows = report.rows.slice(0, 2);
  const isCivicStage = report.exampleSlug === CIVICSTAGE_SLUG;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line bg-ink px-5 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <CompanyLogo name={report.fictionalClient} logoUrl={report.fictionalClientLogo} />
              <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Sample report</p>
              <h2 className="mt-1 text-2xl font-semibold">{report.fictionalClient}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{report.summary}</p>
              </div>
            </div>
            <div className="grid gap-2 text-right text-sm">
              <span className="font-semibold text-white">
                {isCivicStage ? "Full product walkthrough" : `${report.totalSignals} sample signals`}
              </span>
              <span className="text-slate-300">
                {isCivicStage ? "Fictional company, public-source examples" : "Illustrative report structure"}
              </span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-lg border border-line bg-field p-4">
            <Badge tone="locked">Fictional company, real public-source examples</Badge>
            <p className="mt-4 text-sm leading-6 text-slate-700">{report.clientDescription}</p>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Source mix</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.sourceMix.map((source) => (
                  <Badge key={source} tone="blue">{source}</Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            {topRows.map((row) => (
              <article key={row.title} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="green">{row.actionability}</Badge>
                    <Badge tone="blue">{row.revenueMotion}</Badge>
                  </div>
                  <span className="text-sm font-semibold text-ink">{row.revenuePotential}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{row.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{row.target}</p>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-md border border-line bg-field p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contact path</p>
                    <p className="mt-2 font-semibold leading-5 text-ink">{row.contactPath}</p>
                  </div>
                  <div className="rounded-md border border-line bg-field p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next action</p>
                    <p className="mt-2 font-semibold leading-5 text-ink">{row.nextAction}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="border-t border-line bg-field px-5 py-4">
          <a href={`/examples/${report.exampleSlug}`} className="inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            View full sample report
          </a>
        </div>
      </div>
    </section>
  );
}

export function FullSampleReport({ report }: { report: IndustrySampleReport }) {
  const isCivicStage = report.exampleSlug === CIVICSTAGE_SLUG;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line bg-ink px-4 py-5 text-white sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">Sample full report</Badge>
                <Badge tone="locked">Fictional company</Badge>
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight">{report.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{report.clientDescription}</p>
            </div>
            <div className="w-full min-w-0 rounded-lg border border-white/15 bg-white/10 p-4 text-sm sm:w-auto sm:min-w-[16rem]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {isCivicStage ? "Walkthrough scope" : "Sample dataset"}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {isCivicStage ? "Profile to pursuit" : `${report.totalSignals} illustrative signals`}
              </p>
              <p className="mt-3 text-slate-300">
                {isCivicStage ? "Report, monitoring, alerts, and workflow" : "Fictional company, public-source examples"}
              </p>
            </div>
          </div>
        </div>

        <section className="grid gap-5 border-b border-line bg-field p-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Executive brief</p>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              <CompanyLogo name={report.fictionalClient} logoUrl={report.fictionalClientLogo} />
              <h2 className="min-w-0 break-words text-2xl font-semibold text-ink">{report.fictionalClient}</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{report.summary}</p>
          </div>
          <div className="grid gap-3">
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Full report value</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">{report.paidUnlock}</p>
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Best fit</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">{report.outboundUse}</p>
            </div>
          </div>
        </section>

        {isCivicStage ? (
          <section className="border-b border-line bg-white p-6">
            <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">Company enrichment</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">The website becomes a focused search profile</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The product uses public company information and the customer&apos;s scan context to
                  translate a commercial offer into relevant public-sector buyers, programs, source
                  patterns, and search language.
                </p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {civicStageProfile.map(([label, value]) => (
                  <div key={label} className="rounded-md border border-line bg-field p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        ) : null}

        <section className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Opportunity action table</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Top sourced rows</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.sourceMix.map((source) => (
                <Badge key={source} tone="blue">{source}</Badge>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-5">
            {report.rows.map((row) => (
              <article key={row.title} className="rounded-lg border border-line bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="green">{row.actionability}</Badge>
                      <Badge tone="blue">{row.revenueMotion}</Badge>
                      <Badge tone="locked">Priority #{row.priority}</Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-ink">{row.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{row.evidence}</p>
                  </div>
                  {isCivicStage ? (
                    <div className="rounded-md border border-line bg-field px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommended route</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {row.revenueMotion === "Sell to Agency"
                          ? "Contact buyer"
                          : row.revenueMotion === "Partner with Recipient"
                            ? "Start partnership pursuit"
                            : "Review funded-buyer path"}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-line bg-field px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Illustrative value range</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{row.revenuePotential}</p>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-md border border-line bg-field p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Target</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink">{row.target}</p>
                  </div>
                  <div className="rounded-md border border-line bg-field p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contact path</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink">{row.contactPath}</p>
                  </div>
                  <div className="rounded-md border border-line bg-field p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next best action</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink">{row.nextAction}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-md border border-line bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Source</p>
                    <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                      {row.sourceName}
                    </a>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{row.signalType}</p>
                  </div>
                  <div className="rounded-md border border-line bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">First-touch angle</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink">{row.outreachAngle}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {isCivicStage ? (
          <>
            <section className="border-t border-line bg-field p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Customer workflow</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">The report is the start of the work</h2>
                </div>
                <Badge tone="locked">Illustrative product state</Badge>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {civicStageJourney.map((step) => (
                  <article key={step.label} className="rounded-lg border border-line bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ember">{step.label}</p>
                    <h3 className="mt-2 text-base font-semibold text-ink">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="border-t border-line bg-white p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Saved search and alerts</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Creative programming opportunity watch</h2>
                  <div className="mt-4 divide-y divide-line border-y border-line">
                    {[
                      ["Profile", "CivicStage Talent Network"],
                      ["Search focus", "Arts programming, city events, tourism, parks, arts education"],
                      ["Cadence", "Weekly on Monitor or daily on Growth"],
                      ["Review", "New and updated signals, then compare against the prior report"]
                    ].map(([label, value]) => (
                      <div key={label} className="grid gap-1 py-3 sm:grid-cols-[110px_1fr] sm:gap-4">
                        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
                        <p className="text-sm font-semibold leading-6 text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line bg-field p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Account workspace</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Keep the route attached to the evidence</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Reports", "Return to the sourced record and full action table."],
                      ["Pursuits", "Track status, owner, notes, and next action."],
                      ["Comparisons", "Review what appeared or changed between scans."],
                      ["Exports", "Move structured context by download or secure webhook."]
                    ].map(([title, copy]) => (
                      <div key={title} className="rounded-md border border-line bg-white p-3">
                        <p className="text-sm font-semibold text-ink">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{copy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
