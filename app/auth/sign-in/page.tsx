import type { Metadata } from "next";
import { OpportunityScannerLogo } from "@/components/brand";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in securely to your Opportunity Scanner account.",
  robots: { index: false, follow: false }
};

const messages: Record<string, { tone: string; text: string }> = {
  "invalid-email": { tone: "border-red-200 bg-red-50 text-red-700", text: "Enter a valid email address." },
  "rate-limited": { tone: "border-amber-200 bg-amber-50 text-amber-800", text: "Please wait a minute before requesting another link." },
  "request-failed": { tone: "border-red-200 bg-red-50 text-red-700", text: "We could not send your sign-in link. Please try again." },
  "invalid-link": { tone: "border-red-200 bg-red-50 text-red-700", text: "That sign-in link is not valid for this browser. Request a new one below." },
  "expired-link": { tone: "border-red-200 bg-red-50 text-red-700", text: "That sign-in link expired or was already used. Request a new one below." }
};

export default function SignInPage({
  searchParams
}: {
  searchParams?: { error?: string; status?: string; next?: string };
}) {
  const error = searchParams?.error ? messages[searchParams.error] : null;
  const emailSent = searchParams?.status === "email-sent";
  const signedOut = searchParams?.status === "signed-out";
  const nextPath = searchParams?.next || "/";

  return (
    <main className="min-h-screen bg-field">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <OpportunityScannerLogo />
          <a href="/" className="text-sm font-semibold text-steel hover:text-accent">Back to site</a>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-stretch gap-8 px-5 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-16">
        <div className="flex min-h-[320px] flex-col justify-center border-b border-line pb-10 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-14">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Customer access</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Your opportunity work, ready when you are.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted">
            Sign in to return to your sourced signals, buyer targets, and next actions. No password to remember.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {["Saved scans", "Action tables", "Workflow-ready"].map((item) => (
              <div key={item} className="border-l-2 border-accent pl-3 text-sm font-semibold text-steel">{item}</div>
            ))}
          </div>
        </div>

        <div className="self-center rounded-lg border border-line bg-white p-6 shadow-panel sm:p-8">
          <h2 className="text-xl font-semibold text-ink">Sign in with email</h2>
          <p className="mt-2 text-sm leading-6 text-muted">We will send you a secure, one-time sign-in link.</p>

          {emailSent ? (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">
              Check your inbox. The link expires shortly and works in this browser.
            </div>
          ) : null}
          {signedOut ? (
            <div className="mt-5 rounded-md border border-cyan-100 bg-mist px-4 py-3 text-sm text-accent" role="status">
              You have been signed out.
            </div>
          ) : null}
          {error ? <div className={`mt-5 rounded-md border px-4 py-3 text-sm leading-6 ${error.tone}`} role="alert">{error.text}</div> : null}

          <form action="/api/auth/sign-in" method="post" className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Email address</span>
              <input
                required
                autoComplete="email"
                inputMode="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                className="min-h-12 rounded-md border border-line bg-white px-3 py-3 text-ink outline-none placeholder:text-slate-400 focus:border-accent"
              />
            </label>
            <button type="submit" className="min-h-12 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
              Email me a sign-in link
            </button>
          </form>

          <p className="mt-5 text-xs leading-5 text-muted">
            By continuing, you agree to the <a href="/terms" className="font-semibold text-steel hover:text-accent">terms</a> and acknowledge the <a href="/privacy" className="font-semibold text-steel hover:text-accent">privacy notice</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
