import type { ResourceArticle } from "@/lib/marketingContent";

export function ArticleCharts({ charts }: { charts: ResourceArticle["chartAssets"] }) {
  const publishedCharts = charts?.filter((chart) => chart.image) ?? [];

  if (!publishedCharts.length) {
    return null;
  }

  return (
    <section id="article-charts" aria-labelledby="article-charts-title" className="scroll-mt-24">
      <h2 id="article-charts-title" className="text-2xl font-semibold text-ink">Charts and visual evidence</h2>
      <div className="mt-5 grid gap-5">
        {publishedCharts.map((chart) => {
          const image = chart.image!;

          return (
            <figure key={`${chart.title}-${image.src}`} className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              <div className="overflow-x-auto overscroll-contain">
                <img
                  src={image.src}
                  width={image.width}
                  height={image.height}
                  alt={chart.altText}
                  loading="lazy"
                  className="h-auto min-w-[44rem] sm:min-w-0 sm:w-full"
                />
              </div>
              <figcaption className="border-t border-line p-5">
                <p className="font-semibold text-ink">{chart.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{chart.takeaway}</p>
                <a href={image.src} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
                  Open visual full size
                </a>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {image.caption ? `${image.caption} ` : null}
                  Source:{" "}
                  {chart.url ? (
                    <a href={chart.url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                      {chart.source}
                    </a>
                  ) : (
                    chart.source
                  )}
                </p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
