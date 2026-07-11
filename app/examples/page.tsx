import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { MarketingHero, SectionIntro } from "@/components/marketing";
import { sampleReports } from "@/lib/sampleReports";

const title = "Sample Opportunity Reports | Opportunity Scanner";
const description =
  "Sample Opportunity Scanner reports by industry, using fictional companies and real public-sector source examples.";

export const metadata: Metadata = {
  title: "Sample Opportunity Reports",
  description,
  alternates: { canonical: "/examples" },
  openGraph: {
    title,
    description,
    url: "/examples",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

export default function ExamplesPage() {
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
        eyebrow="Sample reports"
        title="See what a public-sector opportunity scan can reveal in your industry."
        secondaryLabel="Run a scan"
        secondaryHref="/#scan"
      >
        <p>
          These examples pair fictional companies with real public-sector source records so you can
          see how evidence becomes revenue motions, contact paths, next actions, and outreach angles.
        </p>
      </MarketingHero>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Industry sample reports" eyebrow="Explore examples">
          <p>
            Choose the example closest to your business to review sourced opportunity rows, likely
            buyer and partner paths, and the additional action details included in a full report.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {sampleReports.map((report) => (
            <article key={report.exampleSlug} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{report.totalSignals} signals</Badge>
                <Badge tone="green">{report.estimatedPipeline}</Badge>
              </div>
              <h2 className="mt-4 text-xl font-semibold leading-7 text-ink">
                <a href={`/examples/${report.exampleSlug}`} className="hover:text-accent">
                  {report.title}
                </a>
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{report.summary}</p>
              <a href={`/examples/${report.exampleSlug}`} className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                View sample report
              </a>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
