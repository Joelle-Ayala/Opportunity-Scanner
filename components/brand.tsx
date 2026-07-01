import { ReactNode } from "react";

export function OpportunityScannerLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-3" aria-label="Opportunity Scanner home">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-sm font-bold text-white">
        OS
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className="block text-base font-semibold text-ink">Opportunity Scanner</span>
          <span className="block text-xs font-medium text-muted">by Opportunity Systems</span>
        </span>
      ) : null}
    </a>
  );
}

export function SiteHeader({ rightSlot }: { rightSlot?: ReactNode }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <OpportunityScannerLogo />
        <div className="flex items-center gap-3">{rightSlot}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted">
        <span>Opportunity Scanner by Opportunity Systems</span>
        <span>Public-sector money-flow and buying-channel intelligence.</span>
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
    slate: "border-line bg-field text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
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
        className="h-14 w-14 rounded-full border border-line bg-white object-contain p-1"
      />
    );
  }

  return (
    <span className="grid h-14 w-14 place-items-center rounded-full border border-line bg-white text-base font-semibold text-ink">
      {initials}
    </span>
  );
}

