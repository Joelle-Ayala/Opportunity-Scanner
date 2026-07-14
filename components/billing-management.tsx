"use client";

import { useEffect, useState } from "react";
import {
  completedSubscriptionCheckoutSession,
  secureStripeBillingPortalUrl
} from "@/components/billing-management-state";

type BillingPortalResponse = {
  ok?: boolean;
  portalUrl?: unknown;
  error?: { message?: unknown };
};

export function BillingManagement({
  checkout,
  checkoutSessionId
}: {
  checkout: unknown;
  checkoutSessionId: unknown;
}) {
  const sessionId = completedSubscriptionCheckoutSession(checkout, checkoutSessionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has("session_id")) return;
    url.searchParams.delete("session_id");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [sessionId]);

  if (!sessionId) return null;

  async function openBillingPortal() {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const body = (await response.json().catch(() => null)) as BillingPortalResponse | null;
      const portalUrl = secureStripeBillingPortalUrl(body?.portalUrl);

      if (!response.ok || !body?.ok || !portalUrl) {
        const message = typeof body?.error?.message === "string"
          ? body.error.message
          : "Billing settings could not be opened. Please try again.";
        throw new Error(message);
      }

      window.location.assign(portalUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing settings could not be opened. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-md border border-line bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <p className="text-sm font-semibold text-ink">Your subscription</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Review invoices, update your payment method, or manage your plan securely with Stripe.
        </p>
        <div aria-live="polite" aria-atomic="true">
          {error ? (
            <p id="billing-portal-error" role="alert" className="mt-2 text-xs leading-5 text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={openBillingPortal}
        disabled={loading}
        aria-describedby={error ? "billing-portal-error" : undefined}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-accent shadow-sm hover:bg-mist disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? "Opening Billing..." : "Manage Subscription"}
      </button>
    </div>
  );
}
