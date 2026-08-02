import { founderStory } from "@/lib/founderStory";

export type FounderNoteProps = {
  variant?: "compact" | "full";
  className?: string;
  showLink?: boolean;
};

function initialsFor(name: string, configuredInitials: string) {
  if (configuredInitials.trim()) {
    return configuredInitials.trim().slice(0, 3).toUpperCase();
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function FounderNote({
  variant = "compact",
  className = "",
  showLink = variant === "compact"
}: FounderNoteProps) {
  const { identity, homepage, bios } = founderStory;
  const headingId = `founder-note-${variant}-heading`;
  const initials = initialsFor(identity.name, identity.initials);
  const isFull = variant === "full";

  return (
    <section
      aria-labelledby={headingId}
      data-variant={variant}
      className={`border-y border-line bg-field ${className}`.trim()}
    >
      <div
        className={`mx-auto grid max-w-7xl gap-7 px-6 ${
          isFull
            ? "py-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] lg:gap-12 lg:py-14"
            : "py-9 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-6 lg:py-10"
        }`}
      >
        <div className={isFull ? "flex items-start gap-4 sm:gap-5" : "contents"}>
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-ink text-sm font-bold text-white shadow-sm"
          >
            {initials}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-accent">{homepage.eyebrow}</p>
            <h2
              id={headingId}
              className={`mt-2 max-w-3xl font-semibold leading-tight text-ink ${
                isFull ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
              }`}
            >
              {homepage.heading}
            </h2>
            <p className={`mt-4 max-w-3xl text-slate-700 ${isFull ? "text-base leading-8" : "text-sm leading-7"}`}>
              {homepage.body}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="text-sm font-semibold text-ink">{homepage.attribution}</p>
              {showLink ? (
                <a
                  href={homepage.ctaPath}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:text-[#0A6871] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {homepage.ctaLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {isFull ? (
          <div className="border-t border-line pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <p className="text-xs font-semibold uppercase text-signal">Founder perspective</p>
            <p className="mt-3 text-base leading-8 text-slate-700">{bios.medium}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
