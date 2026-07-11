"use client";

import { FormEvent, useState } from "react";
import type { BillingInterval, PaymentPlan } from "@/lib/payments/contract";
import { trackProductEvent } from "@/lib/productAnalytics";

type CheckoutButtonProps = {
  plan: PaymentPlan;
  checkoutEnabled: boolean;
  featured?: boolean;
  scanId?: string;
};

type CheckoutResponse = {
  ok?: boolean;
  checkoutUrl?: unknown;
  error?: { message?: unknown };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secureStripeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === "https://checkout.stripe.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function CheckoutButton({
  plan,
  checkoutEnabled,
  featured = false,
  scanId
}: CheckoutButtonProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canCheckout = checkoutEnabled && (plan !== "report" || UUID_PATTERN.test(scanId ?? ""));

  if (!canCheckout) {
    return (
      <a
        href="/#scan"
        className={`mt-5 inline-flex w-full justify-center rounded-md px-4 py-3 text-sm font-semibold shadow-sm ${
          featured
            ? "bg-white text-ink hover:bg-mist"
            : "bg-accent text-white hover:bg-[#0A6871]"
        }`}
      >
        Start With a Free Scan
      </a>
    );
  }

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const customerEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(customerEmail) || customerEmail.length > 254) {
      setError("Enter a valid work email address.");
      return;
    }

    setError("");
    setLoading(true);

    const billingPeriod = plan === "report" ? "one_time" : billingInterval;
    trackProductEvent("email_captured", {
      surface: "checkout",
      marketing_consent: false
    });
    trackProductEvent("checkout_started", {
      plan: plan === "report" ? "full_report" : "subscription",
      billing_period: billingPeriod
    });

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingInterval: plan === "report" ? null : billingInterval,
          customerEmail,
          requestId: crypto.randomUUID(),
          scanId: plan === "report" ? scanId : null
        })
      });
      const body = (await response.json().catch(() => null)) as CheckoutResponse | null;
      const checkoutUrl = secureStripeCheckoutUrl(body?.checkoutUrl);

      if (!response.ok || !body?.ok || !checkoutUrl) {
        const message = typeof body?.error?.message === "string"
          ? body.error.message
          : "Checkout could not be started. Please try again.";
        throw new Error(message);
      }

      window.location.assign(checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={startCheckout} className="mt-5 border-t border-current/15 pt-4" noValidate>
      {plan !== "report" ? (
        <fieldset>
          <legend className={`text-xs font-semibold ${featured ? "text-slate-200" : "text-slate-700"}`}>
            Billing schedule
          </legend>
          <div className={`mt-2 grid grid-cols-2 rounded-md border p-1 ${featured ? "border-white/20 bg-white/10" : "border-line bg-white"}`}>
            {(["monthly", "annual"] as const).map((interval) => {
              const selected = billingInterval === interval;
              return (
                <button
                  key={interval}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBillingInterval(interval)}
                  className={`min-h-9 rounded px-2 py-2 text-xs font-semibold capitalize ${
                    selected
                      ? featured
                        ? "bg-white text-ink shadow-sm"
                        : "bg-ink text-white shadow-sm"
                      : featured
                        ? "text-slate-200 hover:bg-white/10"
                        : "text-slate-600 hover:bg-field"
                  }`}
                >
                  {interval}
                </button>
              );
            })}
          </div>
          <p className={`mt-2 text-xs ${featured ? "text-slate-300" : "text-muted"}`}>
            {billingInterval === "annual" ? "Billed annually with 2 months free." : "Billed month to month."}
          </p>
        </fieldset>
      ) : null}

      <label
        htmlFor={`checkout-email-${plan}`}
        className={`block text-xs font-semibold ${plan === "report" ? "" : "mt-4"} ${featured ? "text-slate-200" : "text-slate-700"}`}
      >
        Work email
      </label>
      <input
        id={`checkout-email-${plan}`}
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-describedby={error ? `checkout-error-${plan}` : undefined}
        aria-invalid={Boolean(error)}
        disabled={loading}
        placeholder="you@company.com"
        className={`mt-2 w-full rounded-md border px-3 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-wait disabled:opacity-70 ${
          error ? "border-red-500" : "border-line"
        }`}
      />

      <button
        type="submit"
        disabled={loading}
        className={`mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold shadow-sm disabled:cursor-wait disabled:opacity-70 ${
          featured
            ? "bg-white text-ink hover:bg-mist"
            : "bg-accent text-white hover:bg-[#0A6871]"
        }`}
      >
        {loading ? "Opening Secure Checkout..." : plan === "report" ? "Buy Full Report" : "Continue to Secure Checkout"}
      </button>

      <div aria-live="polite" aria-atomic="true" className="min-h-6">
        {error ? (
          <p id={`checkout-error-${plan}`} role="alert" className={`mt-2 text-xs leading-5 ${featured ? "text-red-200" : "text-red-700"}`}>
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
