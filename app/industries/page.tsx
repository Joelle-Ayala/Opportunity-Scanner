import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingHero, ReportPreview, SectionIntro } from "@/components/marketing";
import { industryPages } from "@/lib/marketingContent";

const title = "Industries | Opportunity Scanner";
const description =
  "Explore public-sector opportunity signals for healthcare, education, workforce, arts, creative economy, software, AI, and B2B services.";

export const metadata: Metadata = {
  title: "Industries",
  description,
  alternates: { canonical: "/industries" },
  openGraph: {
    title,
    description,
    url: "/industries",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

export default function IndustriesPage() {
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
        eyebrow="Industries"
        title="See how public-sector money can connect to your market."
        secondaryLabel="See example report"
        secondaryHref="#report-preview"
      >
        <p>
          Opportunity Scanner is built for companies that may not know public-sector demand exists
          around what they sell. Start with these priority industries, then scan your own website
          for sourced signals and next actions.
        </p>
      </MarketingHero>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Priority industry paths" eyebrow="Use cases">
          <p>
            Each page explains the public-sector signal types, revenue motions, and next actions a
            full report can surface for that market.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {industryPages.map((industry) => (
            <article key={industry.slug} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <Badge tone="blue">{industry.name}</Badge>
              <h2 className="mt-4 text-xl font-semibold leading-7 text-ink">
                <a href={`/industries/${industry.slug}`} className="hover:text-accent">
                  {industry.headline}
                </a>
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{industry.outcome}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {industry.revenueMotions.slice(0, 3).map((motion) => (
                  <Badge key={motion} tone="green">{motion}</Badge>
                ))}
              </div>
              <a href={`/industries/${industry.slug}`} className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                View industry page
              </a>
            </article>
          ))}
        </div>
      </section>

      <div id="report-preview">
        <ReportPreview />
      </div>

      <CTASection title="Not sure which path fits?">
        <p>
          Scan your company website. The report translates your actual positioning into public-sector
          search terms, opportunity signals, revenue motions, and contact paths.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
