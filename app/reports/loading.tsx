export default function ReportLoading() {
  return (
    <main className="min-h-screen bg-field px-4 py-5 text-ink sm:px-6 sm:py-8" aria-busy="true" aria-label="Loading opportunity report">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <div className="h-5 w-44 animate-pulse rounded-md bg-slate-200" />
          <div className="mt-8 h-9 w-full max-w-xl animate-pulse rounded-md bg-slate-200" />
          <div className="mt-3 h-4 w-56 animate-pulse rounded-md bg-slate-200" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        </header>
        <section className="h-72 animate-pulse rounded-lg border border-line bg-white" />
      </div>
    </main>
  );
}
