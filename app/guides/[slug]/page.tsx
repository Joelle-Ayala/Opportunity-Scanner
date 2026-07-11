import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { LeadMagnetForm } from "@/components/lead-magnet-form";
import { getLeadMagnet, leadMagnets } from "@/lib/leadMagnets";
import { siteUrl } from "@/lib/marketingContent";

export function generateStaticParams() {
  return leadMagnets.map((guide) => ({ slug: guide.slug }));
}
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getLeadMagnet(params.slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `${siteUrl}/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `${siteUrl}/guides/${guide.slug}`,
      type: "article"
    }
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getLeadMagnet(params.slug);
  if (!guide) notFound();

  const isIndustryReport = guide.category === "Industry report";

  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <header className="border-b border-line bg-cream">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-wrap gap-2">
            <Badge tone={isIndustryReport ? "green" : "blue"}>{guide.category}</Badge>
            <Badge tone="locked">Research current July 2026</Badge>
          </div>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{guide.description}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.65fr)] lg:items-start">
        <section aria-labelledby="guide-value">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">What you will gain</p>
          <h2 id="guide-value" className="mt-3 text-3xl font-semibold leading-10 text-ink">{guide.promise}</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {guide.includes.map((item, index) => (
              <div key={item} className="border-l-2 border-accent pl-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Part {index + 1}</p>
                <p className="mt-2 text-base font-semibold leading-7 text-ink">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 border-y border-line py-6">
            <h2 className="text-xl font-semibold text-ink">Built from official source evidence</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {guide.evidenceSummary}
            </p>
          </div>

          <p className="mt-6 text-sm leading-7 text-muted">
            This resource supports market research and business-development planning. It does not promise eligibility, awards, contracts, customers, or revenue.
          </p>
        </section>

        <aside className="rounded-lg border border-line bg-white p-6 shadow-panel" aria-labelledby="unlock-guide">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Free PDF</p>
          <h2 id="unlock-guide" className="mt-2 text-2xl font-semibold text-ink">Get the guide now</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your details to unlock the immediate browser download. Email delivery is not required.
          </p>
          <div className="mt-6">
            <LeadMagnetForm
              slug={guide.slug}
              buttonLabel={guide.buttonLabel}
            />
          </div>
        </aside>
      </div>

      <SiteFooter />
    </main>
  );
}
