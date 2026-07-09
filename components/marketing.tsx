import { ReactNode } from "react";
import { Badge } from "./brand";

export function MarketingHero({
  eyebrow,
  title,
  children,
  ctaLabel = "Scan Your Company Website",
  ctaHref = "/#scan",
  secondaryLabel,
  secondaryHref
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="border-b border-line bg-cream">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
        <Badge tone="blue">{eyebrow}</Badge>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          {title}
        </h1>
        <div className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{children}</div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={ctaHref} className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            {ctaLabel}
          </a>
          {secondaryLabel && secondaryHref ? (
            <a href={secondaryHref} className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:border-accent">
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  children
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
      {children ? <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{children}</div> : null}
    </div>
  );
}

export function MarketingCard({
  title,
  children,
  badge
}: {
  title: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-sm">
      {badge ? <Badge tone="green">{badge}</Badge> : null}
      <h3 className={badge ? "mt-4 text-lg font-semibold text-ink" : "text-lg font-semibold text-ink"}>{title}</h3>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </article>
  );
}

export function CTASection({
  title,
  children,
  ctaLabel = "Run Free Scan"
}: {
  title: string;
  children: ReactNode;
  ctaLabel?: string;
}) {
  return (
    <section className="border-t border-line bg-ink">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 text-white lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{children}</div>
        </div>
        <a href="/#scan" className="inline-flex w-fit rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-mist">
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
