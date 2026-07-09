import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingHero, ReportPreview, RevenueOutcomeGrid, SectionIntro } from "@/components/marketing";
import { solutionPages } from "@/lib/marketingContent";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "Explore Opportunity Scanner solutions for funded buyer intelligence, public-sector sales workflows, and contact paths with enrichment."
};

export default function SolutionsPage() {
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
        eyebrow="Solutions"
        title="Turn public-sector signals into revenue actions."
        secondaryLabel="See pricing"
        secondaryHref="/pricing"
      >
        <p>
          Opportunity Scanner helps teams move from confusing public records to buyer targets,
          contact paths, revenue motions, and workflow-ready opportunity rows.
        </p>
      </MarketingHero>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Launch-ready use cases" eyebrow="Where teams start">
          <p>
            These are the highest-leverage ways to use Opportunity Scanner before building a full
            public-sector sales or capture operation.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {solutionPages.map((solution) => (
            <article key={solution.slug} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <Badge tone="blue">{solution.name}</Badge>
              <h2 className="mt-4 text-xl font-semibold leading-7 text-ink">
                <a href={`/solutions/${solution.slug}`} className="hover:text-accent">
                  {solution.headline}
                </a>
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{solution.description}</p>
              <div className="mt-5 rounded-md border border-line bg-field p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Outcome</p>
                <p className="mt-2 text-sm leading-6 text-ink">{solution.outcome}</p>
              </div>
              <a href={`/solutions/${solution.slug}`} className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                View solution
              </a>
            </article>
          ))}
        </div>
      </section>

      <RevenueOutcomeGrid />
      <ReportPreview />

      <CTASection title="Start with your website. Leave with a public-sector action table.">
        <p>
          The first scan shows whether public-sector demand connects to what you already sell. The
          full report turns that demand into prioritized rows your team can pursue.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
