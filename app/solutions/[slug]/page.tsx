import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingHero, ReportPreview, SectionIntro } from "@/components/marketing";
import { getSolutionPage, solutionPages, siteUrl } from "@/lib/marketingContent";

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return solutionPages.map((solution) => ({ slug: solution.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const solution = getSolutionPage(params.slug);
  if (!solution) {
    return {};
  }

  return {
    title: solution.name,
    description: solution.description,
    alternates: {
      canonical: `${siteUrl}/solutions/${solution.slug}`
    }
  };
}

export default function SolutionDetailPage({ params }: PageProps) {
  const solution = getSolutionPage(params.slug);
  if (!solution) {
    notFound();
  }

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
        eyebrow={solution.name}
        title={solution.headline}
        secondaryLabel="View all solutions"
        secondaryHref="/solutions"
      >
        <p>{solution.description}</p>
      </MarketingHero>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <Badge tone="blue">Who this is for</Badge>
          <p className="mt-4 text-sm leading-6 text-slate-700">{solution.audience}</p>
          <div className="mt-6 border-t border-line pt-6">
            <Badge tone="amber">Problem</Badge>
            <p className="mt-4 text-sm leading-6 text-slate-700">{solution.pain}</p>
          </div>
          <div className="mt-6 border-t border-line pt-6">
            <Badge tone="green">Outcome</Badge>
            <p className="mt-4 text-sm leading-6 text-slate-700">{solution.outcome}</p>
          </div>
        </article>

        <article className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <SectionIntro title="What the report gives your team" eyebrow="Action layer">
            <p>
              The goal is not more research volume. It is clearer decisions about who to pursue,
              why the signal matters, and what to do next.
            </p>
          </SectionIntro>
          <div className="mt-6 grid gap-3">
            {solution.proofPoints.map((point) => (
              <div key={point} className="rounded-md border border-line bg-field p-4 text-sm leading-6 text-slate-700">
                {point}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionIntro title="Example row logic" eyebrow="How it becomes action">
            <p>
              Full reports translate each source signal into a practical row with a revenue motion,
              contact path, and next best action.
            </p>
          </SectionIntro>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {solution.reportRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-line bg-field p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{row.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ReportPreview />

      <CTASection title={solution.cta}>
        <p>
          Run a scan to see which public-sector signals, targets, contact paths, and workflow-ready
          next actions match your company.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
