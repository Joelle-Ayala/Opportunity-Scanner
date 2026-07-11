import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingHero, SectionIntro } from "@/components/marketing";
import { leadMagnets } from "@/lib/leadMagnets";
import { resourceArticles, upcomingResourceIdeas } from "@/lib/marketingContent";

const title = "Resources | Opportunity Scanner";
const description =
  "Guides for companies exploring government spending, grants, funded buyers, procurement, policy signals, and public-sector sales channels.";

export const metadata: Metadata = {
  title: "Resources",
  description,
  alternates: { canonical: "/resources" },
  openGraph: {
    title,
    description,
    url: "/resources",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

const categories = [
  "Public-Sector Sales",
  "Government Contracts",
  "Funded Buyers",
  "Industry Guides",
  "Grants and Funding",
  "Policy Signals",
  "Workforce Funding",
  "Infrastructure",
  "Clean Energy",
  "Manufacturing"
];

export default function ResourcesPage() {
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
        eyebrow="Resources"
        title="Learn how public-sector money becomes new pipeline."
        secondaryLabel="Explore public-sector revenue"
        secondaryHref="/public-sector-revenue"
      >
        <p>
          Practical guides for companies exploring government spending, grants, funded buyers,
          procurement, policy signals, workforce programs, and public-sector sales channels.
        </p>
      </MarketingHero>

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <SectionIntro title="Free field guides" eyebrow="Downloadable research">
            <p>Use the flagship method or start with the healthcare and DME industry report.</p>
          </SectionIntro>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {leadMagnets.map((guide) => (
              <article key={guide.slug} className="rounded-lg border border-line bg-field p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">{guide.category}</p>
                <h2 className="mt-2 text-xl font-semibold leading-7 text-ink">{guide.shortTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{guide.promise}</p>
                <a href={`/guides/${guide.slug}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:text-[#0A6871]">
                  Get the free guide
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Featured guides" eyebrow="Start here">
          <p>
            These first guides are built for founders, revenue leaders, and operators who suspect
            public-sector demand may exist but do not know where to start.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {resourceArticles.map((article) => (
            <article key={article.slug} className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              {article.featuredImage ? (
                <a href={`/resources/${article.slug}`} className="block">
                  <img
                    src={article.featuredImage}
                    alt={article.featuredImageAlt || article.title}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : null}
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="blue">{article.category}</Badge>
                  <Badge tone="locked">{article.readTime}</Badge>
                </div>
                <h2 className="mt-4 text-xl font-semibold leading-7 text-ink">
                  <a href={`/resources/${article.slug}`} className="hover:text-accent">
                    {article.title}
                  </a>
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{article.description}</p>
                {article.practicalList ? (
                  <p className="mt-4 rounded-md bg-field px-3 py-2 text-xs font-semibold leading-5 text-steel">
                    Includes: {article.practicalList.title}
                  </p>
                ) : null}
                <a href={`/resources/${article.slug}`} className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                  Read guide
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro title="Browse by theme" eyebrow="Content pillars">
            <p>
              Opportunity Scanner content is designed to explain public-sector opportunity in
              practical language, then route the reader back to a scan or action table.
            </p>
          </SectionIntro>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((category) => (
              <div key={category} className="rounded-md border border-line bg-field px-4 py-3 text-sm font-semibold text-ink">
                {category}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Publishing next" eyebrow="Content backlog">
          <p>
            These topics are queued for the next content sprint because they connect directly to
            buyer education, SEO intent, and paid report value.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {upcomingResourceIdeas.map((title) => (
            <div key={title} className="rounded-md border border-line bg-white p-4 text-sm font-semibold text-ink shadow-sm">
              {title}
            </div>
          ))}
        </div>
      </section>

      <CTASection title="Want to see where your company fits?">
        <p>
          Run a scan to turn your website into sourced public-sector opportunity signals and next
          best actions.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
