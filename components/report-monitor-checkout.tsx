"use client";

import { FormEvent, useState } from "react";
import { secureStripeBillingPortalUrl } from "@/components/billing-management-state";
import { trackProductEvent } from "@/lib/productAnalytics";

type ReportMonitorCheckoutProps = {
  companyName: string;
  defaultEmail?: string;
};

type CheckoutResponse = {
  ok?: boolean;
  checkoutUrl?: unknown;
  portalUrl?: unknown;
  error?: { message?: unknown };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function secureStripeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://checkout.stripe.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ReportMonitorCheckout({
  companyName,
  defaultEmail
}: ReportMonitorCheckoutProps) {
  const accountEmail = defaultEmail?.trim().toLowerCase() ?? "";
  const [email, setEmail] = useState(accountEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const needsEmail = !EMAIL_PATTERN.test(accountEmail);

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const customerEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(customerEmail) || customerEmail.length > 254) {
      setError("Enter the email you use for Opportunity Scanner.");
      return;
    }

    setError("");
    setLoading(true);
    trackProductEvent("checkout_started", {
      plan: "subscription",
      billing_period: "monthly"
    });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "monitor",
          billingInterval: "monthly",
          customerEmail,
          requestId: crypto.randomUUID(),
          scanId: null
        })
      });
      const body = (await response.json().catch(() => null)) as CheckoutResponse | null;
      const checkoutUrl = secureStripeCheckoutUrl(body?.checkoutUrl);
      const portalUrl = secureStripeBillingPortalUrl(body?.portalUrl);

      if (!response.ok || !body?.ok || (!checkoutUrl && !portalUrl)) {
        const message = typeof body?.error?.message === "string"
          ? body.error.message
          : "Checkout could not be started. Please try again.";
        throw new Error(message);
      }

      window.location.assign(checkoutUrl || portalUrl!);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="monitor-report-heading" className="overflow-hidden rounded-lg border border-accent bg-white shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase text-accent">Keep this pipeline current</p>
          <h2 id="monitor-report-heading" className="mt-2 text-xl font-semibold text-ink sm:text-2xl">
            New opportunities will not wait for your next report.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
            Monitor {companyName} weekly for newly found public-sector opportunities. Start from
            this paid report, then confirm the search in onboarding.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
            {[
              "Weekly opportunity scans",
              "New opportunity alerts",
              "Full action layer on monitored scans"
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line bg-mist p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-end gap-2">
            <p className="text-3xl font-semibold text-ink">$99</p>
            <p className="pb-1 text-sm text-muted">per month</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">One company profile. Cancel future renewals anytime.</p>

          <form onSubmit={startCheckout} className="mt-4" noValidate>
            {needsEmail ? (
              <>
                <label htmlFor="report-monitor-email" className="block text-xs font-semibold text-slate-700">
                  Account email
                </label>
                <input
                  id="report-monitor-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-describedby={error ? "report-monitor-error" : undefined}
                  aria-invalid={Boolean(error)}
                  disabled={loading}
                  placeholder="you@company.com"
                  className={`mt-2 w-full rounded-md border bg-white px-3 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-wait disabled:opacity-70 ${
                    error ? "border-red-500" : "border-line"
                  }`}
                />
              </>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? "Opening Secure Checkout..." : "Monitor This Report Weekly"}
            </button>

            <div aria-live="polite" aria-atomic="true" className="min-h-6">
              {error ? (
                <p id="report-monitor-error" role="alert" className="mt-2 text-xs leading-5 text-red-700">
                  {error}
                </p>
              ) : null}
            </div>
          </form>
          <p className="text-center text-xs leading-5 text-muted">Secure checkout by Stripe</p>
        </div>
      </div>
    </section>
  );
}
