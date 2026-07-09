import type { ResourceArticle } from "@/lib/marketingContent";

export function articleSectionId(heading: string) {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ArticleTableOfContents({ article }: { article: ResourceArticle }) {
  const items = article.sections.map((section) => ({
    id: articleSectionId(section.heading),
    label: section.heading
  }));

  if (article.practicalList) {
    items.push({ id: "practical-checklist", label: article.practicalList.title });
  }
  if (article.chartAssets?.some((chart) => chart.image)) {
    items.push({ id: "article-charts", label: "Charts and visual evidence" });
  }
  if (article.proofPoints?.length) {
    items.push({ id: "sources-cited", label: "Sources cited" });
  }

  if (items.length < 2) {
    return null;
  }

  return (
    <nav aria-labelledby="table-of-contents-title" className="rounded-lg border border-line bg-cream p-5">
      <h2 id="table-of-contents-title" className="text-sm font-semibold uppercase tracking-[0.1em] text-ink">
        In this guide
      </h2>
      <ol className="mt-4 grid gap-2 text-sm leading-6 text-slate-700 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="group flex gap-2 rounded-md px-2 py-1.5 hover:bg-white hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
              <span className="text-slate-400 group-hover:text-accent">{index + 1}.</span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
