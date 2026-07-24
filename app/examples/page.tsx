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
  const featuredReport = sampleReports.find(
    (report) => report.exampleSlug === "creative-economy-live-events-opportunity-scan"
  );
  const industryReports = sampleReports.filter(
    (report) => report.exampleSlug !== featuredReport?.exampleSlug
  );

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
          Start with CivicStage to see the full product workflow, then explore industry reports built
          from fictional companies and public-source examples.
        </p>
      </MarketingHero>

      {featuredReport ? (
        <section className="border-b border-line bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <Badge tone="green">Featured product walkthrough</Badge>
              <div className="mt-5 flex items-center gap-4">
                <img
                  src={featuredReport.fictionalClientLogo}
                  alt=""
                  className="h-12 w-12 rounded-md border border-line bg-white object-contain p-1"
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">Fictional company</p>
                  <h2 className="mt-1 text-2xl font-semibold text-ink">{featuredReport.fictionalClient}</h2>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-600">
                Follow a company profile from website analysis to sourced opportunity rows, an
                opportunity-specific pursuit route, saved monitoring, alerts, comparisons, and
                export or webhook handoff.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {["Company profile", "Sourced full report", "Pursuit workspace", "Monitoring and workflow"].map((item) => (
                  <div key={item} className="rounded-md border border-line bg-field px-3 py-3 text-sm font-semibold text-ink">
                    {item}
                  </div>
                ))}
              </div>
              <a
                href={`/examples/${featuredReport.exampleSlug}`}
                className="mt-6 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                Open CivicStage walkthrough
              </a>
            </div>
            <div className="overflow-hidden rounded-lg border border-line bg-field shadow-panel">
              <img
                src="/product-proof/report-overview.jpg"
                alt="CivicStage sample report showing sourced opportunity intelligence"
                className="aspect-[4/3] w-full object-cover object-left-top sm:aspect-[16/10]"
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="More industry sample reports" eyebrow="Explore examples">
          <p>
            Choose the example closest to your business to review sourced opportunity rows, likely
            buyer and partner paths, and the action details included in a full report. These examples
            illustrate product structure; they are not customer results or performance claims.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {industryReports.map((report) => (
            <article key={report.exampleSlug} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{report.totalSignals} sample signals</Badge>
                <Badge tone="locked">Fictional company</Badge>
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
