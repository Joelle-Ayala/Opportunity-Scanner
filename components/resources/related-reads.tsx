import type { ResourceArticle } from "@/lib/marketingContent";

type RelatedResource = Pick<
  ResourceArticle,
  "slug" | "title" | "description" | "category" | "readTime"
>;

export function RelatedReads({ articles }: { articles: RelatedResource[] }) {
  if (!articles.length) {
    return null;
  }

  return (
    <section aria-labelledby="related-reads-title" className="border-t border-line pt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Keep exploring</p>
      <h2 id="related-reads-title" className="mt-2 text-2xl font-semibold text-ink">Related reads</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {articles.map((article) => (
          <article key={article.slug} className="flex h-full flex-col rounded-lg border border-line bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-accent">{article.category}</p>
            <h3 className="mt-2 text-lg font-semibold leading-7 text-ink">
              <a href={`/resources/${article.slug}`} className="hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
                {article.title}
              </a>
            </h3>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{article.description}</p>
            <p className="mt-auto pt-5 text-xs font-semibold text-slate-500">{article.readTime}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
