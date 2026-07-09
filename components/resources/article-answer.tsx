import type { ResourceArticle } from "@/lib/marketingContent";

export function ArticleAnswer({ article }: { article: ResourceArticle }) {
  return (
    <section aria-labelledby="short-answer" className="rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Quick answer</p>
      <h2 id="short-answer" className="mt-2 text-2xl font-semibold text-ink">The short answer</h2>
      <p className="mt-4 text-lg leading-8 text-slate-700">{article.intro}</p>

      {article.keyTakeaways?.length ? (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-base font-semibold text-ink">Key takeaways</h3>
          <ul className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
            {article.keyTakeaways.map((takeaway) => (
              <li key={takeaway} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
