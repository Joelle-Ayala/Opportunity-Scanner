"use client";

import { FormEvent, useState } from "react";
import { secureStripeBillingPortalUrl } from "@/components/billing-management-state";
import type { BillingInterval } from "@/lib/payments/contract";
import { trackProductEvent } from "@/lib/productAnalytics";

type ReportMonitorCheckoutProps = {
  companyName: string;
  defaultEmail?: string;
  scanId: string;
};

type CheckoutResponse = {
  ok?: boolean;
  checkoutUrl?: unknown;
  portalUrl?: unknown;
  error?: { message?: unknown };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type SubscriptionPlan = "monitor" | "growth";

const SUBSCRIPTION_OPTIONS: Record<SubscriptionPlan, {
  name: string;
  cadence: string;
  profiles: string;
  monthlyPrice: number;
  annualPrice: number;
  benefits: string[];
}> = {
  monitor: {
    name: "Monitor",
    cadence: "Weekly monitoring",
    profiles: "1 company profile",
    monthlyPrice: 99,
    annualPrice: 990,
    benefits: ["Weekly opportunity scans", "New opportunity alerts", "Full action layer on every included scan"]
  },
  growth: {
    name: "Growth",
    cadence: "Daily monitoring",
    profiles: "Up to 3 company profiles",
    monthlyPrice: 249,
    annualPrice: 2_490,
    benefits: ["Daily opportunity scans", "30 monthly contact-enrichment credits", "CRM and webhook workflows"]
  }
};

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
  defaultEmail,
  scanId
}: ReportMonitorCheckoutProps) {
  const accountEmail = defaultEmail?.trim().toLowerCase() ?? "";
  const [email, setEmail] = useState(accountEmail);
  const [plan, setPlan] = useState<SubscriptionPlan>("monitor");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const needsEmail = !EMAIL_PATTERN.test(accountEmail);
  const selectedOption = SUBSCRIPTION_OPTIONS[plan];
  const displayedPrice = billingInterval === "annual"
    ? selectedOption.annualPrice
    : selectedOption.monthlyPrice;

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
      plan,
      billing_period: billingInterval
    });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingInterval,
          customerEmail,
          requestId: crypto.randomUUID(),
          scanId
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
      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase text-accent">Keep this pipeline current</p>
          <h2 id="monitor-report-heading" className="mt-2 text-xl font-semibold text-ink sm:text-2xl">
            New opportunities will not wait for your next report.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
            Keep {companyName} current with repeat scans and newly found public-sector
            opportunities. This report will already be selected when you finish secure checkout.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
            {selectedOption.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line bg-mist p-5 sm:p-6 lg:border-l lg:border-t-0">
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">Monitoring plan</legend>
            <div className="mt-2 grid grid-cols-2 rounded-md border border-line bg-white p-1">
              {(["monitor", "growth"] as const).map((optionPlan) => {
                const option = SUBSCRIPTION_OPTIONS[optionPlan];
                const selected = plan === optionPlan;
                return (
                  <button
                    key={optionPlan}
                    type="button"
                    aria-pressed={selected}
                    disabled={loading}
                    onClick={() => setPlan(optionPlan)}
                    className={`min-h-12 rounded px-2 py-2 text-left text-xs disabled:cursor-wait disabled:opacity-70 ${
                      selected ? "bg-ink text-white shadow-sm" : "text-slate-600 hover:bg-field"
                    }`}
                  >
                    <span className="block font-semibold">{option.name}</span>
                    <span className={`mt-0.5 block ${selected ? "text-slate-300" : "text-muted"}`}>
                      {option.cadence}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-slate-700">Billing schedule</legend>
            <div className="mt-2 grid grid-cols-2 rounded-md border border-line bg-white p-1">
              {(["monthly", "annual"] as const).map((interval) => {
                const selected = billingInterval === interval;
                return (
                  <button
                    key={interval}
                    type="button"
                    aria-pressed={selected}
                    disabled={loading}
                    onClick={() => setBillingInterval(interval)}
                    className={`min-h-9 rounded px-2 py-2 text-xs font-semibold capitalize disabled:cursor-wait disabled:opacity-70 ${
                      selected ? "bg-white text-ink shadow-sm ring-1 ring-ink" : "text-slate-600 hover:bg-field"
                    }`}
                  >
                    {interval}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-end gap-2">
            <p className="mt-5 text-3xl font-semibold text-ink">
              ${displayedPrice.toLocaleString("en-US")}
            </p>
            <p className="pb-1 text-sm text-muted">per {billingInterval === "annual" ? "year" : "month"}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            {selectedOption.profiles}. {billingInterval === "annual" ? "12 months for the price of 10." : "Cancel future renewals anytime."}
          </p>

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
              {loading ? "Opening Secure Checkout..." : `Start ${selectedOption.name} With This Report`}
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
