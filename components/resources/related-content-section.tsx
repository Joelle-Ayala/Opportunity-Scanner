import Link from "next/link";
import { getResourceArticle, type RelatedResourceSlugs } from "@/lib/marketingContent";

type RelatedContentSectionProps = {
  relatedResourceSlugs: RelatedResourceSlugs;
};

export function RelatedContentSection({ relatedResourceSlugs }: RelatedContentSectionProps) {
  const articles = relatedResourceSlugs.map((slug) => {
    const article = getResourceArticle(slug);

    if (!article) {
      throw new Error(`Related resource does not exist: ${slug}`);
    }

    return article;
  });

  return (
    <section aria-labelledby="related-insights-title" className="border-t border-line bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              Keep exploring
            </p>
            <h2 id="related-insights-title" className="mt-2 text-2xl font-semibold text-ink">
              Related insights
            </h2>
          </div>
          <Link
            href="/resources"
            className="w-fit rounded-sm text-sm font-semibold text-accent hover:text-[#0A6871] focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            View all resources
          </Link>
        </div>

        <ul role="list" className="mt-5 grid gap-4 md:grid-cols-3">
          {articles.map((article) => (
            <li key={article.slug} className="min-w-0">
              <Link
                href={`/resources/${article.slug}`}
                className="group flex h-full min-w-0 flex-col rounded-lg border border-line bg-field p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
                  <span className="text-accent">{article.category}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-slate-500">{article.readTime}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-7 text-ink transition group-hover:text-accent">
                  {article.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                  {article.description}
                </p>
                <span className="mt-auto pt-4 text-sm font-semibold text-accent" aria-hidden="true">
                  Read insight <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
