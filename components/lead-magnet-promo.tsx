import { getLeadMagnet, type LeadMagnetSlug } from "@/lib/leadMagnets";

export function LeadMagnetPromo({ slug }: { slug: LeadMagnetSlug }) {
  const guide = getLeadMagnet(slug)!;

  return (
    <section className="border-y border-line bg-cream" aria-label={`Free guide: ${guide.shortTitle}`}>
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 md:flex-row md:items-center">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Free {guide.category.toLowerCase()}</p>
          <h2 className="mt-2 text-2xl font-semibold leading-8 text-ink">{guide.shortTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{guide.promise}</p>
        </div>
        <a
          href={`/guides/${guide.slug}`}
          className="inline-flex min-h-11 w-fit shrink-0 items-center rounded-md border border-accent bg-white px-4 py-3 text-sm font-semibold text-accent shadow-sm hover:bg-mist"
        >
          View free guide
        </a>
      </div>
    </section>
  );
}
