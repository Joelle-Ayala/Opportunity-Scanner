import { OpportunityScannerLogo } from "@/components/brand";

const navigation = [
  { href: "/admin", label: "Operations" },
  { href: "/admin/reports", label: "Report review" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/sources", label: "Sources" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-field">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <OpportunityScannerLogo />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-semibold uppercase text-slate-500 sm:inline">
              Operator workspace
            </span>
            <form action="/api/auth/sign-out" method="post">
              <button
                type="submit"
                className="min-h-10 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-steel hover:text-accent"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Admin navigation" className="border-t border-line">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-semibold text-steel hover:bg-field hover:text-accent"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
