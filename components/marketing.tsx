import { ReactNode } from "react";
import { Badge } from "./brand";
import { revenueOutcomes } from "@/lib/marketingContent";

export function MarketingHero({
  eyebrow,
  title,
  children,
  ctaLabel = "Scan Your Company Website",
  ctaHref = "/#scan",
  secondaryLabel,
  secondaryHref
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
        <Badge tone="blue">{eyebrow}</Badge>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          {title}
        </h1>
        <div className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{children}</div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={ctaHref} className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            {ctaLabel}
          </a>
          {secondaryLabel && secondaryHref ? (
            <a href={secondaryHref} className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:border-accent">
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  children
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
      {children ? <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{children}</div> : null}
    </div>
  );
}

export function MarketingCard({
  title,
  children,
  badge
}: {
  title: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-sm">
      {badge ? <Badge tone="green">{badge}</Badge> : null}
      <h3 className={badge ? "mt-4 text-lg font-semibold text-ink" : "text-lg font-semibold text-ink"}>{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </article>
  );
}

export function CTASection({
  title,
  children,
  ctaLabel = "Run Free Scan"
}: {
  title: string;
  children: ReactNode;
  ctaLabel?: string;
}) {
  return (
    <section className="border-t border-line bg-ink">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 text-white lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{children}</div>
        </div>
        <a href="/#scan" className="inline-flex w-fit rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-mist">
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}

export function RevenueOutcomeGrid({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "" : "border-y border-line bg-white"}>
      <div className={compact ? "" : "mx-auto max-w-7xl px-6 py-12"}>
        <SectionIntro title="Revenue outcomes the scan can surface" eyebrow="What this turns into">
          <p>
            The scan is not trying to summarize your company. It is trying to identify public-sector
            paths your team can actually pursue, route, monitor, or move into a workflow.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {revenueOutcomes.map((outcome) => (
            <article key={outcome.label} className="rounded-lg border border-line bg-field p-5">
              <h3 className="text-base font-semibold text-ink">{outcome.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{outcome.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReportPreview({ compact = false }: { compact?: boolean }) {
  const rows = [
    {
      priority: "1",
      target: "County program office",
      signal: "Public money already moved",
      motion: "Sell to Funded Buyer",
      value: "$248K",
      contact: "Program owner / procurement path",
      action: "Build source-backed outreach task"
    },
    {
      priority: "2",
      target: "Agency grant program",
      signal: "Active funding or procurement signal",
      motion: "Sell to Agency",
      value: "$1.2M",
      contact: "Source-native contact first",
      action: "Inspect source contact and vendor path"
    },
    {
      priority: "3",
      target: "Award recipient",
      signal: "Recipient funded for adjacent work",
      motion: "Partner with Recipient",
      value: "Not stated",
      contact: "Enrich company domain",
      action: "Identify partnerships owner"
    }
  ];

  return (
    <section className={compact ? "" : "mx-auto max-w-7xl px-6 py-12"}>
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line bg-ink px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Example full report</p>
              <h2 className="mt-1 text-xl font-semibold">Opportunity Action Table</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                A full scan turns sourced records into prioritized rows your team can route,
                enrich, export, and pursue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Revenue motion</Badge>
              <Badge tone="blue">Contact path</Badge>
              <Badge tone="amber">Workflow-ready</Badge>
            </div>
          </div>
        </div>
        <div className="grid gap-0 overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead className="bg-field text-xs uppercase tracking-wide text-muted">
              <tr>
                {["Priority", "Target", "Signal", "Revenue Motion", "Value", "Contact Path", "Next Best Action"].map((heading) => (
                  <th key={heading} className="border-b border-line px-4 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.priority} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-4 font-semibold text-accent">#{row.priority}</td>
                  <td className="px-4 py-4 font-semibold text-ink">{row.target}</td>
                  <td className="px-4 py-4 text-slate-600">{row.signal}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-accent">{row.motion}</span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-ink">{row.value}</td>
                  <td className="px-4 py-4 text-slate-600">{row.contact}</td>
                  <td className="px-4 py-4 text-slate-600">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-line bg-field p-5 md:grid-cols-4">
          {[
            ["Revenue outcomes", "Apply, sell to an agency, sell to a funded buyer, partner with a recipient, or monitor demand."],
            ["Contact strategy", "Use source-native contacts first, then offices, portals, partner paths, or capped enrichment."],
            ["Paid action layer", "Unlock all rows, outreach drafts, CRM-ready notes, source links, and export-ready context."],
            ["Workflow movement", "Export rows to CSV/Markdown or send workflow-ready payloads to outbound and CRM systems."]
          ].map(([title, copy]) => (
            <div key={title} className="rounded-md border border-line bg-white p-4">
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
