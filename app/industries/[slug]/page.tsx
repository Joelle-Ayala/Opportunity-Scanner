import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingHero, ReportPreview, SectionIntro } from "@/components/marketing";
import { LeadMagnetPromo } from "@/components/lead-magnet-promo";
import { RelatedContentSection } from "@/components/resources/related-content-section";
import { SampleReportPreview } from "@/components/sample-report";
import { getIndustryPage, industryPages, siteUrl } from "@/lib/marketingContent";
import { getLeadMagnetForIndustry } from "@/lib/leadMagnets";
import { getSampleReportByIndustry } from "@/lib/sampleReports";

export function generateStaticParams() {
  return industryPages.map((industry) => ({ slug: industry.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const industry = getIndustryPage(params.slug);
  if (!industry) {
    return {};
  }

  return {
    title: industry.name,
    description: industry.description,
    alternates: {
      canonical: `${siteUrl}/industries/${industry.slug}`
    },
    openGraph: {
      title: `${industry.name} | Opportunity Scanner`,
      description: industry.description,
      url: `${siteUrl}/industries/${industry.slug}`,
      type: "website"
    }
  };
}

export default function IndustryPage({ params }: { params: { slug: string } }) {
  const industry = getIndustryPage(params.slug);
  if (!industry) {
    notFound();
  }
  const sampleReport = getSampleReportByIndustry(industry.slug);
  const industryGuide = getLeadMagnetForIndustry(industry.slug);

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
        eyebrow={industry.name}
        title={industry.headline}
        secondaryLabel="See example report"
        secondaryHref="#report-preview"
      >
        <p>{industry.description}</p>
        <p className="mt-4 text-base leading-7 text-slate-600">{industry.outcome}</p>
      </MarketingHero>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionIntro title="Signals this scan can look for" eyebrow="Source-backed demand">
          <p>
            The goal is not to flood the report with data. The goal is to identify signals that can
            become a revenue motion, contact path, or next action.
          </p>
        </SectionIntro>
        <div className="grid gap-3 sm:grid-cols-2">
          {industry.signals.map((signal) => (
            <div key={signal} className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm">
              {signal}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionIntro title="Possible revenue outcomes" eyebrow="What the report clarifies">
            <p>
              Your scan turns public-sector data into possible revenue motions: apply for funding,
              sell to an agency, sell to a funded buyer, partner with an award recipient, monitor
              emerging policy demand, register as a vendor, or push the opportunity into your sales
              workflow.
            </p>
          </SectionIntro>
          <div className="mt-6 flex flex-wrap gap-2">
            {industry.revenueMotions.map((motion) => (
              <Badge key={motion} tone="green">{motion}</Badge>
            ))}
          </div>
        </div>
      </section>

      {sampleReport ? <SampleReportPreview report={sampleReport} /> : null}

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Example opportunity rows" eyebrow="What you might see">
          <p>
            Real reports use sourced records. These examples show the type of action row the product
            is designed to produce for this industry.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {industry.exampleRows.map((row) => (
            <article key={row.target} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{row.revenueMotion}</Badge>
                <Badge tone="locked">Example row</Badge>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink">{row.target}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{row.signal}</p>
              <div className="mt-4 rounded-md border border-line bg-field p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next best action</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink">{row.nextAction}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div id="report-preview">
        <ReportPreview />
      </div>

      <RelatedContentSection relatedResourceSlugs={industry.relatedResourceSlugs} />

      {industryGuide ? <LeadMagnetPromo slug={industryGuide.slug} /> : null}

      <CTASection title="Turn public-sector signals into a target list.">
        <p>
          Scan your company website to find source-backed opportunities, revenue motions, contact
          paths, and next actions for this market.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
