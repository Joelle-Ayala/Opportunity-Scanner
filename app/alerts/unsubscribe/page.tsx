import type { Metadata } from "next";
import { hasValidAlertUnsubscribeTokenShape } from "@/lib/deadlineAlerts/token";

export const metadata: Metadata = {
  title: "Alert Preferences",
  description: "Manage Opportunity Scanner monitoring alerts.",
  robots: { index: false, follow: false }
};

export default function AlertUnsubscribePage({
  searchParams
}: {
  searchParams?: { token?: string; status?: string };
}) {
  const completed = searchParams?.status === "unsubscribed";
  const token = searchParams?.token || "";
  const validShape = hasValidAlertUnsubscribeTokenShape(token);

  return (
    <main className="min-h-screen bg-field">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-6">
          <a href="/" className="text-sm font-semibold text-ink">Opportunity Scanner</a>
          <a href="/dashboard?tab=alerts" className="text-sm font-semibold text-steel hover:text-accent">Alert preferences</a>
        </div>
      </header>
      <section className="mx-auto max-w-xl px-5 py-14 sm:px-6 sm:py-20">
        <div className="rounded-lg border border-line bg-white p-6 shadow-panel sm:p-8">
          <p className="text-xs font-semibold uppercase text-accent">Email alerts</p>
          {completed ? (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-ink">Alerts are off</h1>
              <p className="mt-3 text-sm leading-6 text-muted">You will not receive new opportunity or deadline alert emails. You can turn them back on from your dashboard.</p>
            </>
          ) : validShape ? (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-ink">Stop all alert emails?</h1>
              <p className="mt-3 text-sm leading-6 text-muted">Monitoring will continue, but Opportunity Scanner will stop emailing new opportunity and deadline reminders.</p>
              <form action="/api/deadline-alerts/unsubscribe" method="post" className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="min-h-11 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-steel focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">Unsubscribe from alerts</button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-ink">This link is not valid</h1>
              <p className="mt-3 text-sm leading-6 text-muted">Use the unsubscribe link in your most recent Opportunity Scanner alert.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

