import type { Metadata } from "next";
import { OpportunityScannerLogo } from "@/components/brand";
import { hasValidUnsubscribeTokenShape } from "@/lib/nurture/token";

export const metadata: Metadata = {
  title: "Email Preferences",
  description: "Manage Opportunity Scanner post-scan email preferences.",
  robots: { index: false, follow: false }
};

export default function UnsubscribePage({
  searchParams
}: {
  searchParams?: { token?: string; status?: string };
}) {
  const completed = searchParams?.status === "unsubscribed";
  const token = searchParams?.token || "";
  const validShape = hasValidUnsubscribeTokenShape(token);

  return (
    <main className="min-h-screen bg-field">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-6">
          <OpportunityScannerLogo />
          <a href="/" className="text-sm font-semibold text-steel hover:text-accent">Back to site</a>
        </div>
      </header>
      <section className="mx-auto max-w-xl px-5 py-14 sm:px-6 sm:py-20">
        <div className="rounded-lg border border-line bg-white p-6 shadow-panel sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Email preferences</p>
          {completed ? (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-ink">You are unsubscribed</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                You will not receive any more post-scan nurture emails from Opportunity Scanner.
              </p>
            </>
          ) : validShape ? (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-ink">Stop post-scan emails?</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                This stops the remaining follow-up emails connected to your Opportunity Scanner reports.
              </p>
              <form action="/api/nurture/unsubscribe" method="post" className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="min-h-11 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-steel focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
                  Unsubscribe
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl font-semibold text-ink">This link is not valid</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                Use the unsubscribe link in your most recent Opportunity Scanner email.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
