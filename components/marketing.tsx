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

export function ProductActionPath({ compact = false }: { compact?: boolean }) {
  const steps = [
    ["1", "Review the evidence", "See whether the row is a verified live opportunity or historical funded-buyer evidence."],
    ["2", "Open the official route", "Go to the authoritative application, bid, vendor, buyer, or partner source."],
    ["3", "Start a pursuit", "Create a working record without losing the source, target, motion, or contact path."],
    ["4", "Own the next step", "Assign an owner, qualify fit, set an internal due date, and track notes and requirements."],
    ["5", "Move it into workflow", "Export the row or send verified, workflow-ready context to your connected system."]
  ];

  return (
    <section className={compact ? "" : "border-y border-line bg-white"}>
      <div className={compact ? "" : "mx-auto max-w-7xl px-6 py-12"}>
        <SectionIntro title="From sourced finding to owned next action" eyebrow="Inside the product">
          <p>
            Opportunity Scanner does not submit an application for you. It opens the official route,
            keeps the evidence attached, and gives your team a workspace to qualify and advance the pursuit.
          </p>
        </SectionIntro>
        <div className="mt-6 grid border-y border-line sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-line">
          {steps.map(([number, title, copy]) => (
            <article key={number} className="border-b border-line py-5 sm:px-4 lg:border-b-0 lg:first:pl-0 lg:last:pr-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-mist text-xs font-semibold text-accent">
                {number}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">{copy}</p>
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
      recordClass: "Live opportunity",
      target: "Public communications office",
      signal: "Verified open procurement route",
      motion: "Sell to Agency",
      contact: "Official bid instructions",
      action: "Review requirements and make a bid/no-bid decision",
      sourceAction: "Open official source"
    },
    {
      priority: "2",
      recordClass: "Funded-buyer evidence",
      target: "Regional cultural organization",
      signal: "2023 award evidence; not an open opportunity",
      motion: "Partner with Recipient",
      contact: "Recipient program or partner route",
      action: "Validate current need before outreach",
      sourceAction: "Open award record"
    }
  ];

  return (
    <section className={compact ? "" : "mx-auto max-w-7xl px-6 py-12"}>
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line bg-ink px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Illustrative product workspace</p>
              <h2 className="mt-1 text-xl font-semibold">From opportunity row to active pursuit</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Review the evidence class, open the authoritative source, and keep the next action
                moving in one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Revenue motion</Badge>
              <Badge tone="blue">Contact path</Badge>
              <Badge tone="amber">Pursuit-ready</Badge>
            </div>
          </div>
        </div>
        <div className="grid gap-0 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-field text-xs uppercase tracking-wide text-muted">
              <tr>
                {["Priority", "Evidence class", "Target", "Revenue motion", "Contact path", "Next best action", "Actions"].map((heading) => (
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
                  <td className="px-4 py-4">
                    <span className="rounded-md border border-line bg-field px-2.5 py-1 text-xs font-semibold text-ink">
                      {row.recordClass}
                    </span>
                    <span className="mt-2 block max-w-48 text-xs leading-5 text-muted">{row.signal}</span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-ink">{row.target}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-accent">{row.motion}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{row.contact}</td>
                  <td className="px-4 py-4 text-slate-600">{row.action}</td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-40 flex-col gap-2">
                      <span className="rounded-md border border-line bg-white px-3 py-2 text-center text-xs font-semibold text-ink">
                        {row.sourceAction}
                      </span>
                      <span className="rounded-md bg-accent px-3 py-2 text-center text-xs font-semibold text-white">
                        Start pursuit
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-line bg-field p-5 md:grid-cols-4">
          {[
            ["Source attached", "The official record and evidence class stay connected to the opportunity."],
            ["Owner and fit", "Assign responsibility and record pursue, hold, or pass decisions."],
            ["Pursuit workspace", "Track the next step, internal due date, requirements, documents, and notes."],
            ["Workflow movement", "Export rows or send verified opportunity context through a secure webhook."]
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
