import { ReactNode } from "react";

const navGroups = [
  {
    label: "Product",
    links: [
      ["Overview", "/"],
      ["How It Works", "/how-it-works"],
      ["Public-Sector Revenue", "/public-sector-revenue"],
      ["Pricing", "/pricing"]
    ]
  },
  {
    label: "Solutions",
    links: [
      ["All Solutions", "/solutions"],
      ["Funded Buyer Intelligence", "/solutions/funded-buyer-intelligence"],
      ["Sales Workflow", "/solutions/public-sector-sales-workflow"],
      ["Contact Paths", "/solutions/contact-paths-and-enrichment"]
    ]
  },
  {
    label: "Industries",
    links: [
      ["All Industries", "/industries"],
      ["Healthcare & DME", "/industries/healthcare-dme-medical-supply"],
      ["Education & Workforce", "/industries/education-workforce-training"],
      ["Arts & Live Events", "/industries/arts-creative-economy-live-events"],
      ["Software & B2B Services", "/industries/software-b2b-services-ai"]
    ]
  },
  {
    label: "Resources",
    links: [
      ["Resources", "/resources"],
      ["Free Guides", "/guides"],
      ["Sample Reports", "/examples"],
      ["Source Coverage", "/source-coverage"],
      ["Government Spending Channel", "/resources/government-spending-growth-channel"],
      ["Can My Business Sell?", "/resources/can-my-business-sell-to-government"]
    ]
  }
];

export function OpportunityScannerLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/" className="flex min-w-0 items-center gap-3" aria-label="Opportunity Scanner home">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-white shadow-lift sm:h-11 sm:w-11">
        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-signal" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-review" />
        <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-ember" />
        <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-accent" />
        <span className="relative">OS</span>
      </span>
      {!compact ? (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-ink sm:text-base">Opportunity Scanner</span>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-muted sm:block">Opportunity Systems</span>
        </span>
      ) : null}
    </a>
  );
}

export function SiteHeader({ rightSlot }: { rightSlot?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-white/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:py-4">
        <div className="min-w-0">
          <OpportunityScannerLogo />
        </div>

        <nav className="hidden flex-1 items-center justify-center gap-x-2 text-sm font-semibold text-steel lg:flex">
          {navGroups.map((group) => (
            <details key={group.label} className="group relative">
              <summary className="list-none rounded-md px-3 py-2 hover:bg-mist hover:text-accent [&::-webkit-details-marker]:hidden">
                {group.label}
              </summary>
              <div className="absolute left-0 top-10 z-30 w-72 rounded-lg border border-line bg-white p-2 shadow-lift">
                {group.links.map(([label, href]) => (
                  <a key={href} href={href} className="block rounded-md px-3 py-2 text-sm font-semibold text-steel hover:bg-mist hover:text-accent">
                    {label}
                  </a>
                ))}
              </div>
            </details>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">{rightSlot}</div>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold leading-none text-white shadow-sm hover:bg-[#0A6871]">
            Scan
          </a>
          <details className="group relative">
            <summary className="list-none rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold leading-none text-ink shadow-sm hover:border-accent [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav className="absolute right-0 top-11 grid max-h-[75vh] w-[min(88vw,340px)] gap-2 overflow-y-auto rounded-lg border border-line bg-white p-3 text-sm font-semibold text-steel shadow-lift">
              {navGroups.map((group) => (
                <div key={group.label} className="rounded-md border border-line bg-field p-2">
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                  <div className="grid gap-1">
                    {group.links.map(([label, href]) => (
                      <a key={href} href={href} className="rounded-md bg-white px-3 py-2 hover:bg-mist hover:text-accent">
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const productLinks = [
    ["Public-Sector Revenue", "/public-sector-revenue"],
    ["Solutions", "/solutions"],
    ["Sample Reports", "/examples"],
    ["Source Coverage", "/source-coverage"],
    ["Resources", "/resources"],
    ["Free Guides", "/guides"],
    ["Pricing", "/pricing"]
  ];
  const trustLinks = [
    ["About", "/about"],
    ["Terms", "/terms"],
    ["Privacy", "/privacy"]
  ];

  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 text-sm text-muted lg:grid-cols-[1.15fr_1fr_.7fr]">
        <div>
          <span className="font-semibold text-white">Opportunity Scanner by Opportunity Systems</span>
          <p className="mt-2 max-w-md text-slate-300">Public-sector money-flow and buying-channel intelligence for companies exploring a new revenue path.</p>
          <a className="mt-4 inline-block font-semibold text-slate-200 hover:text-white" href="mailto:support@opportunityscanner.ai">
            support@opportunityscanner.ai
          </a>
        </div>
        <nav aria-label="Product and resources">
          <p className="font-semibold text-white">Explore</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            {productLinks.map(([label, href]) => (
              <a key={href} href={href} className="text-slate-300 hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </nav>
        <nav aria-label="Company and legal">
          <p className="font-semibold text-white">Company &amp; trust</p>
          <div className="mt-3 grid gap-3">
            {trustLinks.map(([label, href]) => (
              <a key={href} href={href} className="text-slate-300 hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </footer>
  );
}

export function Badge({
  children,
  tone = "slate"
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "locked";
}) {
  const tones = {
    slate: "border-line bg-white text-steel",
    blue: "border-cyan-100 bg-mist text-accent",
    green: "border-emerald-100 bg-emerald-50 text-signal",
    amber: "border-amber-100 bg-amber-50 text-review",
    red: "border-red-100 bg-red-50 text-red-700",
    locked: "border-slate-200 bg-white text-slate-500"
  };

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ScoreBadge({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  );
}

export function LockedBadge() {
  return <Badge tone="locked">Locked in full scan</Badge>;
}

export function CompanyLogo({
  name,
  logoUrl
}: {
  name: string;
  logoUrl?: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "CO";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
      className="h-14 w-14 rounded-lg border border-line bg-white object-contain p-1 shadow-sm"
      />
    );
  }

  return (
    <span className="grid h-14 w-14 place-items-center rounded-lg border border-line bg-white text-base font-semibold text-ink shadow-sm">
      {initials}
    </span>
  );
}
