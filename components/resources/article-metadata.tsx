import type { ResourceArticle } from "@/lib/marketingContent";

function formatArticleDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function ArticleMetadata({ article }: { article: ResourceArticle }) {
  if (!article.author && !article.publishedAt && !article.lastReviewedAt) {
    return null;
  }

  return (
    <div aria-label="Article details" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
      {article.author ? (
        <span>
          By{" "}
          {article.author.url ? (
            <a href={article.author.url} rel="author" className="font-semibold text-ink hover:text-accent">
              {article.author.name}
            </a>
          ) : (
            <span className="font-semibold text-ink">{article.author.name}</span>
          )}
        </span>
      ) : null}
      {article.publishedAt ? (
        <span>
          Published <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
        </span>
      ) : null}
      {article.lastReviewedAt ? (
        <span>
          Last reviewed <time dateTime={article.lastReviewedAt}>{formatArticleDate(article.lastReviewedAt)}</time>
        </span>
      ) : null}
    </div>
  );
}
