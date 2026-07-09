import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingHero, SectionIntro } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start with a free Opportunity Scanner report, then unlock the full action layer with all signals, contact paths, outreach drafts, and workflow export."
};

const freeItems = [
  "2-3 sourced opportunity signals",
  "Total signals found",
  "Target lanes and source summaries",
  "Preview of public-sector fit",
  "Recommended next steps"
];

const paidItems = [
  "Full prioritized opportunity table",
  "All source links and source records",
  "Revenue motion for each opportunity",
  "Next best action for each row",
  "Contact paths and source-native contacts",
  "Capped contact enrichment where appropriate",
  "CRM-ready notes and outreach drafts",
  "CSV, Markdown, and workflow-ready exports"
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <MarketingHero
        eyebrow="Pricing"
        title="Start with a free scan. Unlock the action layer when you are ready to pursue."
        secondaryLabel="See how it works"
        secondaryHref="/how-it-works"
      >
        <p>
          The free report shows real public-sector fit. The full report turns that fit into a
          workflow-ready opportunity table with source evidence, contact paths, outreach context,
          and next actions.
        </p>
      </MarketingHero>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 lg:grid-cols-2">
        <article className="rounded-lg border border-line bg-white p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">Free</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Opportunity preview</h2>
            </div>
            <p className="text-3xl font-semibold text-ink">$0</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            See whether public-sector money signals are relevant before you commit budget or build a
            public-sector sales motion.
          </p>
          <ul className="mt-5 grid gap-3 text-sm text-slate-700">
            {freeItems.map((item) => (
              <li key={item} className="rounded-md border border-line bg-field px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
          <a href="/#scan" className="mt-6 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        </article>

        <article className="rounded-lg border-2 border-accent bg-white p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">Full report</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Action-ready pipeline</h2>
            </div>
            <p className="text-3xl font-semibold text-ink">$99</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Unlock all qualified signals plus the pursuit layer: who to pursue, why now, what to do
            next, and how to move the row into outreach or CRM.
          </p>
          <ul className="mt-5 grid gap-3 text-sm text-slate-700">
            {paidItems.map((item) => (
              <li key={item} className="rounded-md border border-line bg-mist px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
          <a href="/#scan" className="mt-6 inline-flex rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            Start With Free Scan
          </a>
        </article>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionIntro title="Contacts are part of the paid action layer" eyebrow="Important">
            <p>
              Paid reports include source-native contact paths and capped contact enrichment where
              appropriate. When a direct contact is not available, the report recommends the best
              next step, such as a procurement office, program office, funded recipient, vendor
              registration path, partner target, or manual research task.
            </p>
          </SectionIntro>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["No guaranteed emails", "Some opportunities should route through official source contacts, offices, portals, or partner targets."],
              ["Focused enrichment", "Contact enrichment is capped so the report prioritizes relevant, actionable people and paths."],
              ["Workflow-ready outputs", "Rows are structured for CRM notes, outreach drafts, CSV exports, and webhook-based workflows."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-line bg-field p-5">
                <Badge tone="green">{title}</Badge>
                <p className="mt-4 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection title="Find out whether the channel is worth pursuing.">
        <p>
          The free scan gives you a credible starting point. The full report gives your team the
          action layer when you are ready to move.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
