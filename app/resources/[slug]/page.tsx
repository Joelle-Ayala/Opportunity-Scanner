import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection } from "@/components/marketing";
import { getResourceArticle, resourceArticles, siteUrl } from "@/lib/marketingContent";

export function generateStaticParams() {
  return resourceArticles.map((article) => ({ slug: article.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getResourceArticle(params.slug);
  if (!article) {
    return {};
  }

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `${siteUrl}/resources/${article.slug}`
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${siteUrl}/resources/${article.slug}`,
      type: "article"
    }
  };
}

export default function ResourceArticlePage({ params }: { params: { slug: string } }) {
  const article = getResourceArticle(params.slug);
  if (!article) {
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

      <article>
        <header className="border-b border-line bg-cream">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">{article.category}</Badge>
              <Badge tone="locked">{article.readTime}</Badge>
              <Badge tone="green">{article.funnelStage}</Badge>
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              {article.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">{article.description}</p>
            <p className="mt-4 text-sm font-semibold text-muted">Primary topic: {article.primaryKeyword}</p>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-lg leading-8 text-slate-700">{article.intro}</p>
          <div className="mt-10 grid gap-10">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-semibold text-ink">{section.heading}</h2>
                <div className="mt-4 grid gap-4 text-base leading-8 text-slate-700">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-line bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-ink">Next step</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{article.cta}</p>
            <a href="/#scan" className="mt-5 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
              Scan Your Company Website
            </a>
          </div>
        </div>
      </article>

      <CTASection title="Turn the idea into an opportunity table.">
        <p>
          Opportunity Scanner reads your website, finds sourced public-sector signals, and
          translates them into target organizations, contact paths, and next best actions.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
