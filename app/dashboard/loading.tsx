export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-field text-ink" aria-busy="true" aria-label="Loading customer workspace">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-xs font-bold text-white">OS</span>
          <span className="text-sm font-semibold sm:text-base">Opportunity Scanner</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded-md bg-slate-200" />
        <div className="mt-8 grid grid-cols-3 gap-2 border-b border-line pb-2 sm:flex sm:gap-6">
          {["Overview", "Reports", "Searches", "Alerts", "Billing"].map((label) => (
            <span key={label} className="min-h-11 rounded-md bg-slate-100 px-3 py-3 text-center text-xs font-semibold text-slate-500">
              {label}
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-lg border border-line bg-white" />
          ))}
        </div>
      </div>
    </main>
  );
}
