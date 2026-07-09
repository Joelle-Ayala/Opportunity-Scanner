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
      type: "article",
      images: article.featuredImage
        ? [
            {
              url: article.featuredImage,
              alt: article.featuredImageAlt || article.title
            }
          ]
        : undefined
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
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.6fr)] lg:items-center">
            <div>
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
            {article.featuredImage ? (
              <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
                <img
                  src={article.featuredImage}
                  alt={article.featuredImageAlt || article.title}
                  className="h-72 w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-lg leading-8 text-slate-700">{article.intro}</p>

          {article.keyTakeaways?.length ? (
            <section className="mt-8 rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-ink">Key takeaways</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {article.keyTakeaways.map((takeaway) => (
                  <li key={takeaway} className="rounded-md border border-line bg-field p-3">
                    {takeaway}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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

          {article.practicalList ? (
            <section className="mt-10 rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-ink">{article.practicalList.title}</h2>
              <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
                {article.practicalList.items.map((item, index) => (
                  <li key={item} className="flex gap-3 rounded-md border border-line bg-field p-3">
                    <span className="font-semibold text-accent">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {article.proofPoints?.length ? (
            <section className="mt-10 rounded-lg border border-line bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-ink">Stats and proof points</h2>
              <div className="mt-4 grid gap-3">
                {article.proofPoints.map((point) => (
                  <a
                    key={`${point.source}-${point.stat}`}
                    href={point.url}
                    className="rounded-md border border-line bg-field p-4 text-sm leading-6 text-slate-700 hover:border-accent"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="block font-semibold text-ink">{point.source}</span>
                    <span className="mt-1 block">{point.stat}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {article.quote ? (
            <section className="mt-10 rounded-lg border border-line bg-ink p-5 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Source-backed quote</p>
              <blockquote className="mt-3 text-xl font-semibold leading-8">"{article.quote.text}"</blockquote>
              <p className="mt-3 text-sm text-slate-300">
                Source: <a href={article.quote.url} className="underline" target="_blank" rel="noreferrer">{article.quote.source}</a>
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Social note: {article.quote.taggable}. {article.quote.approvalStatus}
              </p>
            </section>
          ) : null}

          {article.socialPack ? (
            <section className="mt-10 rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">Carousel-ready</Badge>
                <Badge tone="green">X thread-ready</Badge>
                <Badge tone="amber">Stat + quote post</Badge>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Repurposing source block</h2>
              <div className="mt-5 grid gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Carousel angle</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{article.socialPack.carouselTitle}</p>
                  <ol className="mt-3 grid gap-2 text-sm text-slate-700">
                    {article.socialPack.carouselSlides.map((slide, index) => (
                      <li key={slide} className="rounded-md bg-field px-3 py-2">
                        {index + 1}. {slide}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">X thread hook</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{article.socialPack.xThreadHook}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-line bg-field p-4">
                    <h3 className="text-sm font-semibold text-ink">Stat post</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{article.socialPack.statPost}</p>
                  </div>
                  <div className="rounded-md border border-line bg-field p-4">
                    <h3 className="text-sm font-semibold text-ink">Quote post</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{article.socialPack.quotePost}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink">Featured image direction</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{article.socialPack.featuredImagePrompt}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Suggested social tags: {article.socialPack.suggestedTags.join(", ")}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

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
