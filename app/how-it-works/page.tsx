import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingCard, MarketingHero, SectionIntro } from "@/components/marketing";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how Opportunity Scanner turns a company website into sourced public-sector opportunity signals, contact paths, and next best actions."
};

const steps = [
  {
    title: "Scan your company",
    badge: "Step 1",
    copy:
      "We read your website to understand what you sell, who you serve, where you operate, and how that maps into public-sector buying, funding, workforce, reimbursement, and policy language."
  },
  {
    title: "Find sourced opportunity signals",
    badge: "Step 2",
    copy:
      "The scan looks for relevant signals across public spending, procurement, grants, policy, workforce programs, reimbursement pathways, funded buyers, and award recipients."
  },
  {
    title: "Translate signals into actions",
    badge: "Step 3",
    copy:
      "Each useful signal becomes an opportunity row with a target organization, source evidence, revenue motion, actionability, contact path, and next best action."
  },
  {
    title: "Move it into outreach",
    badge: "Step 4",
    copy:
      "Paid reports add the deeper action layer: CRM-ready notes, outreach angles, workflow export, source-native contact paths, and capped contact enrichment where appropriate."
  }
];

export default function HowItWorksPage() {
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
        eyebrow="How it works"
        title="From company website to public-sector opportunity pipeline."
        secondaryLabel="Read the revenue channel guide"
        secondaryHref="/public-sector-revenue"
      >
        <p>
          Scan your website, match your business to public-sector money signals, and get
          prioritized opportunity rows with source links, revenue motions, contact paths, and next
          best actions.
        </p>
      </MarketingHero>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <MarketingCard key={step.title} title={step.title} badge={step.badge}>
            <p>{step.copy}</p>
          </MarketingCard>
        ))}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionIntro title="What comes back in a useful scan" eyebrow="Output">
            <p>
              The report is designed to answer what a founder, sales team, partnerships lead, or
              operator needs next: where public money is moving, who to pursue, why it matters, and
              how to act without staring at raw government data.
            </p>
          </SectionIntro>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Opportunity signal",
              "Target organization",
              "Source link",
              "Revenue motion",
              "Actionability",
              "Contact path",
              "Next best action",
              "Workflow-ready note"
            ].map((item) => (
              <div key={item} className="rounded-md border border-line bg-field px-4 py-3 text-sm font-semibold text-ink">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="The product is not trying to force every signal into one path" eyebrow="Contact strategy">
          <p>
            Sometimes the right next step is an email. Sometimes it is a procurement office, program
            office, source-native contact, vendor registration path, partner target, grantee,
            award recipient, distributor, or manual research task.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Source-native first", "When a source record includes a useful program or procurement contact, the report preserves that path before third-party enrichment."],
            ["Paid enrichment where appropriate", "Paid reports can run capped enrichment for relevant companies, vendors, recipients, or partner targets."],
            ["No fake certainty", "If a direct contact is not available, the report recommends the most practical contact path or research task."]
          ].map(([title, copy]) => (
            <article key={title} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <Badge tone="blue">{title}</Badge>
              <p className="mt-4 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <CTASection title="Start with a lightweight scan.">
        <p>
          You do not need a government sales team to check whether public-sector demand exists
          around what your company already sells.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
