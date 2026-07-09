import { ReactNode } from "react";

export function OpportunityScannerLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-3" aria-label="Opportunity Scanner home">
      <span className="relative grid h-11 w-11 place-items-center rounded-lg bg-ink text-sm font-bold text-white shadow-lift">
        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-signal" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-review" />
        <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-ember" />
        <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-accent" />
        <span className="relative">OS</span>
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-base font-semibold text-ink">Opportunity Scanner</span>
          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">Opportunity Systems</span>
        </span>
      ) : null}
    </a>
  );
}

export function SiteHeader({ rightSlot }: { rightSlot?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-white/92 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <OpportunityScannerLogo />
        <nav className="hidden items-center gap-5 text-sm font-semibold text-steel md:flex">
          <a href="/how-it-works" className="hover:text-accent">How It Works</a>
          <a href="/public-sector-revenue" className="hover:text-accent">Public-Sector Revenue</a>
          <a href="/resources" className="hover:text-accent">Resources</a>
          <a href="/pricing" className="hover:text-accent">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">{rightSlot}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted">
        <span className="font-semibold text-white">Opportunity Scanner by Opportunity Systems</span>
        <span className="text-slate-300">Public-sector money-flow and buying-channel intelligence.</span>
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
