import { Badge, CompanyLogo } from "@/components/brand";
import type { IndustrySampleReport, SampleReportRow } from "@/lib/sampleReports";

const CIVICSTAGE_SLUG = "creative-economy-live-events-opportunity-scan";

const civicStageProfile = [
  ["Offer", "Curated artist, performer, teaching-artist, and cultural-programming marketplace"],
  ["Likely buyers", "Cities, schools, venues, parks, tourism offices, and funded cultural organizations"],
  ["Search language", "Public events, arts education, placemaking, cultural programming, tourism, and creative workforce"],
  ["Revenue paths", "Sell to Agency, Sell to Funded Buyer, Partner with Recipient, and Monitor"]
] as const;

const pursuitJourney = [
  {
    label: "1. Verify",
    title: "Open the official source",
    copy: "Confirm status, eligibility, timing, and instructions at the authoritative record before acting."
  },
  {
    label: "2. Qualify",
    title: "Make a fit decision",
    copy: "Choose pursue, monitor, partner, or pass and keep the decision attached to the source evidence."
  },
  {
    label: "3. Own",
    title: "Start a pursuit",
    copy: "Assign an owner, set an internal next step, and track requirements, documents, notes, and follow-up."
  },
  {
    label: "4. Move",
    title: "Send qualified context",
    copy: "Export the row or send a workflow-ready source, target, contact path, and next action by secure webhook."
  }
] as const;

function formatCloseDate(closeDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${closeDate}T00:00:00Z`));
}

function RecordClassBadge({ row }: { row: SampleReportRow }) {
  return row.recordClass === "current" ? (
    <Badge tone="green">Verified live opportunity</Badge>
  ) : (
    <Badge tone="locked">Evidence / market signal</Badge>
  );
}

function SampleActions({ row, pursuitTarget }: { row: SampleReportRow; pursuitTarget: string }) {
  return (
    <div className="mt-4 rounded-md border border-cyan-200 bg-mist p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Product actions</p>
        <span className="text-xs text-muted">Illustrative walkthrough</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={row.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
        >
          Open official source
        </a>
        <a
          href={`#${pursuitTarget}`}
          className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0A6871]"
        >
          Start pursuit preview
        </a>
      </div>
    </div>
  );
}

function CompactPursuitPreview({
  report,
  targetId
}: {
  report: IndustrySampleReport;
  targetId: string;
}) {
  return (
    <div id={targetId} className="scroll-mt-24 rounded-lg border border-line bg-field p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Pursuit workspace preview</p>
          <p className="mt-1 text-sm font-semibold text-ink">Turn a qualified finding into owned work</p>
        </div>
        <Badge tone="locked">Illustrative product state</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Stage", "Qualifying"],
          ["Owner", "Business development lead"],
          ["Next step", report.rows[0]?.nextAction ?? "Verify the source and choose a route"]
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md border border-line bg-white p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-2 break-words text-sm font-semibold leading-5 text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SampleRowCard({
  row,
  pursuitTarget,
  compact = false
}: {
  row: SampleReportRow;
  pursuitTarget: string;
  compact?: boolean;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <RecordClassBadge row={row} />
            <Badge tone="blue">{row.revenueMotion}</Badge>
            {!compact ? <Badge tone="locked">Priority #{row.priority}</Badge> : null}
          </div>
          <h3 className={`${compact ? "text-base" : "text-xl"} mt-4 font-semibold text-ink`}>{row.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{compact ? row.target : row.evidence}</p>
        </div>
        {row.recordClass === "current" ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Verified close date</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">{formatCloseDate(row.closeDate)}</p>
          </div>
        ) : (
          <div className="rounded-md border border-line bg-field px-3 py-2 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Use as</p>
            <p className="mt-1 text-sm font-semibold text-ink">Buyer and demand evidence</p>
          </div>
        )}
      </div>

      {!compact ? (
        <>
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
          <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-md border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Source record</p>
              <p className="mt-2 text-sm font-semibold text-ink">{row.sourceName}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{row.signalType}</p>
            </div>
            <div className="rounded-md border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">First-touch angle</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">{row.outreachAngle}</p>
            </div>
          </div>
        </>
      ) : null}

      <SampleActions row={row} pursuitTarget={pursuitTarget} />
    </article>
  );
}

export function SampleReportPreview({ report }: { report: IndustrySampleReport }) {
  const topRows = report.rows.slice(0, 2);
  const pursuitTarget = `pursuit-preview-${report.exampleSlug}`;

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
              <span className="font-semibold text-white">Report-to-pursuit preview</span>
              <span className="text-slate-300">Fictional company, public-source examples</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="grid content-start gap-4">
            <div className="rounded-lg border border-line bg-field p-4">
              <Badge tone="locked">Fictional company, public-source examples</Badge>
              <p className="mt-4 text-sm leading-6 text-slate-700">{report.clientDescription}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {report.sourceMix.map((source) => (
                  <Badge key={source} tone="blue">{source}</Badge>
                ))}
              </div>
            </div>
            <CompactPursuitPreview report={report} targetId={pursuitTarget} />
          </div>
          <div className="grid gap-3">
            {topRows.map((row) => (
              <SampleRowCard key={row.title} row={row} pursuitTarget={pursuitTarget} compact />
            ))}
          </div>
        </div>
        <div className="border-t border-line bg-field px-5 py-4">
          <a
            href={`/examples/${report.exampleSlug}`}
            className="inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
          >
            View full sample report
          </a>
        </div>
      </div>
    </section>
  );
}

export function FullSampleReport({ report }: { report: IndustrySampleReport }) {
  const isCivicStage = report.exampleSlug === CIVICSTAGE_SLUG;
  const liveRows = report.rows.filter((row) => row.recordClass === "current");
  const evidenceRows = report.rows.filter((row) => row.recordClass === "evidence");

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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Walkthrough scope</p>
              <p className="mt-2 text-xl font-semibold text-white">Source to pursuit</p>
              <p className="mt-3 text-slate-300">{liveRows.length} verified live · {evidenceRows.length} evidence rows shown</p>
            </div>
          </div>
        </div>

        <section className="grid gap-5 border-b border-line bg-field p-6 lg:grid-cols-2">
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Full report includes</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink">
                {report.paidUnlock.replace(/^Unlock\s+/i, "")}
              </p>
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
                  Public company information and customer scan context translate the commercial offer into relevant buyers,
                  programs, source patterns, and search language.
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

        <section id="live-opportunities" className="scroll-mt-24 border-b border-line bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Verified current records</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Live opportunities</h2>
            </div>
            <Badge tone="green">{liveRows.length} verified live</Badge>
          </div>
          {liveRows.length > 0 ? (
            <div className="mt-6 grid gap-5">
              {liveRows.map((row) => (
                <SampleRowCard key={row.title} row={row} pursuitTarget="pursuit-workspace" />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-line bg-field p-6">
              <p className="text-base font-semibold text-ink">No verified live opportunities in this sample.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                None of these fictional sample rows has a future close date verified after August 5, 2026. A customer report
                only places a record here after its official source and future close date are checked.
              </p>
            </div>
          )}
        </section>

        <section id="funded-buyer-evidence" className="scroll-mt-24 border-b border-line bg-field p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Historical and market context</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Funded-buyer evidence and demand signals</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                These records support buyer, partner, and market research. They are not presented as open applications or bids.
              </p>
            </div>
            <Badge tone="locked">{evidenceRows.length} evidence rows</Badge>
          </div>
          <div className="mt-6 grid gap-5">
            {evidenceRows.map((row) => (
              <SampleRowCard key={row.title} row={row} pursuitTarget="pursuit-workspace" />
            ))}
          </div>
        </section>

        <section id="pursuit-workspace" className="scroll-mt-24 bg-white p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Customer workflow</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">The report becomes a tracked pursuit</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Opportunity Scanner opens the authoritative route and organizes the work. It does not submit an application or bid for the customer.
              </p>
            </div>
            <Badge tone="locked">Illustrative product state</Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {pursuitJourney.map((step) => (
              <article key={step.label} className="rounded-lg border border-line bg-field p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ember">{step.label}</p>
                <h3 className="mt-2 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-5">
            <CompactPursuitPreview report={report} targetId={`pursuit-state-${report.exampleSlug}`} />
          </div>
        </section>
      </div>
    </div>
  );
}
