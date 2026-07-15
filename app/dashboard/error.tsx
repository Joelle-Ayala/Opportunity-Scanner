"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-field px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase text-accent">Customer workspace</p>
        <h1 className="mt-2 text-2xl font-semibold">Your account could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your reports are still protected. Retry the account request, or return to sign in if your session expired.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-[#0A6871]">
            Retry
          </button>
          <a href="/auth/sign-in?next=%2Fdashboard" className="rounded-md border border-line px-4 py-3 text-sm font-semibold text-ink hover:border-accent">
            Sign in again
          </a>
          <a href="/" className="px-2 py-3 text-sm font-semibold text-accent hover:underline">Home</a>
        </div>
      </div>
    </main>
  );
}
