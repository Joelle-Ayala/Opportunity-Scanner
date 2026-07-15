"use client";

export default function ReportError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-field px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase text-accent">Opportunity report</p>
        <h1 className="mt-2 text-2xl font-semibold">This report could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Retry the report request. If access was just purchased, signing in again with the purchase email will safely restore the report.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-[#0A6871]">
            Retry report
          </button>
          <a href="/dashboard" className="rounded-md border border-line px-4 py-3 text-sm font-semibold text-ink hover:border-accent">
            Dashboard
          </a>
          <a href="mailto:in@joelleayala.com" className="px-2 py-3 text-sm font-semibold text-accent hover:underline">
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
