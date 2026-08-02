import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { FounderNote } from "@/components/founder-note";
import { founderStory } from "@/lib/founderStory";

const { about, identity } = founderStory;

export const metadata: Metadata = {
  title: { absolute: about.metadata.title },
  description: about.metadata.description,
  alternates: { canonical: about.metadata.canonicalPath },
  openGraph: {
    title: about.metadata.openGraphTitle,
    description: about.metadata.openGraphDescription,
    url: about.metadata.canonicalPath,
    siteName: "Opportunity Scanner",
    type: "website",
    images: [
      {
        url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png",
        width: 1200,
        height: 630,
        alt: "Opportunity Scanner public-sector revenue intelligence"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: about.metadata.openGraphTitle,
    description: about.metadata.openGraphDescription,
    images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"]
  }
};

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function AboutPage() {
  const aboutPageSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": "https://www.opportunityscanner.ai/about#page",
    url: "https://www.opportunityscanner.ai/about",
    name: about.metadata.title,
    description: about.metadata.description,
    mainEntity: { "@id": identity.schemaId },
    isPartOf: { "@id": "https://www.opportunityscanner.ai/#website" }
  };

  return (
    <main className="min-h-screen bg-field">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(aboutPageSchema) }} />
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
          <p className="text-xs font-semibold uppercase text-accent">{about.hero.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            {about.hero.heading}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{about.hero.introduction}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/#scan" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
              Run a Free Scan
            </a>
            <a href="/examples" className="inline-flex min-h-11 items-center rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:border-accent">
              See Sample Reports
            </a>
          </div>
        </div>
      </section>

      <FounderNote showLink={false} />

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <div className="grid gap-x-14 gap-y-12 lg:grid-cols-2">
            {about.sections.map((section, index) => (
              <section key={section.id} aria-labelledby={`${section.id}-heading`} className="border-t-2 border-line pt-6">
                <p className="text-xs font-semibold text-ember">0{index + 1}</p>
                <h2 id={`${section.id}-heading`} className="mt-3 text-2xl font-semibold leading-tight text-ink">
                  {section.heading}
                </h2>
                <div className="mt-4 grid gap-4 text-base leading-8 text-slate-700">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-field">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-accent">The operating standard</p>
            <h2 className="mt-3 text-3xl font-semibold text-ink">Useful intelligence stays close to its evidence.</h2>
          </div>
          <div className="mt-8 grid border-y border-line md:grid-cols-3 md:divide-x md:divide-line">
            {about.principles.map((principle, index) => (
              <article key={principle.title} className="border-b border-line py-6 last:border-b-0 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0">
                <p className="text-xs font-semibold text-signal">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-ink">{principle.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{principle.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 px-6 py-12 md:flex-row md:items-center">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold">Find the public-sector paths around your current offer.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{about.closing}</p>
          </div>
          <a href={about.ctaPath} className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-mist">
            {about.ctaLabel}
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
