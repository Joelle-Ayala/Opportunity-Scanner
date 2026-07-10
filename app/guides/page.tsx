import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { leadMagnets } from "@/lib/leadMagnets";
import { siteUrl } from "@/lib/marketingContent";

export const metadata: Metadata = {
  title: "Public-Sector Revenue Guides",
  description: "Free, source-backed field guides for turning public-sector records into practical revenue actions.",
  alternates: { canonical: `${siteUrl}/guides` }
};

export default function GuidesPage() {
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
        <div className="mx-auto max-w-7xl px-6 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Field guides and research</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Public-sector revenue guides
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Practical, source-backed reports for deciding which agencies, funded organizations, partners, and opportunity paths deserve action.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12" aria-labelledby="available-guides">
        <h2 id="available-guides" className="text-2xl font-semibold text-ink">Available guides</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {leadMagnets.map((guide) => (
            <article key={guide.slug} className="flex h-full flex-col rounded-lg border border-line bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={guide.category === "Industry report" ? "green" : "blue"}>{guide.category}</Badge>
                <Badge tone="locked">Updated {guide.updatedAt}</Badge>
              </div>
              <h2 className="mt-5 text-2xl font-semibold leading-8 text-ink">{guide.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{guide.description}</p>
              <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-700 sm:grid-cols-2">
                {guide.includes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-signal" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={`/guides/${guide.slug}`}
                className="mt-6 inline-flex min-h-11 w-fit items-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                View guide
              </a>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
